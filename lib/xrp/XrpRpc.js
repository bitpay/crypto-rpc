const xrpl = require('xrpl');
const XrpClientAdapter = require('./XrpClientAdapter');
const promptly = require('promptly');
const util = require('util');
const EventEmitter = require('events');

const passwordPromptAsync = util.promisify(promptly.password);

class XrpRpc {
  constructor(config) {
    this.config = config;
    const {
      rpcPort,
      host,
      protocol,
      address,
      useClientAdapter = true
    } = config;
    const connectionString = `${protocol}://${host}:${rpcPort}`;
    // Use client adapter to include implementations of ripple-lib Client methods as an extension to the xrpl Client
    this.rpc = useClientAdapter ? new XrpClientAdapter(connectionString) : new xrpl.Client(connectionString);
    this.address = address;
    this.emitter = new EventEmitter();
    this.connectionIdleTimeout = null;
    this.connectionIdleMs = config.connectionIdleMs || 120000;
    this.rpc.on('error', () => {}); // ignore rpc connection errors as we reconnect if nec each request
  }

  async asyncCall(method, args) {
    // clear idle timer if exists
    clearTimeout(this.connectionIdleTimeout);
    // reset idle timer
    this.connectionIdleTimeout = setTimeout(async () => {
      try {
        await this.rpc.disconnect();
      } catch (_) {
        // ignore disconnection error on idle
      }
    }, this.connectionIdleMs);
    this.connectionIdleTimeout.unref();

    if (!this.rpc.isConnected()) {
      // if there is an error connecting, throw error and try again on next call
      await this.rpc.connect();
    }
    const result = await this.rpc[method](args);
    return result;
  }

  async asyncRequest(method, args) {
    return this.asyncCall('request', Object.assign({ command: method }, args));
  }

  async unlockAndSendToAddress({ address, amount, secret }) {
    if (secret === undefined) {
      secret = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    return await this.sendToAddress({ address, amount, secret });
  }

  async sendToAddress({ address, amount, passphrase, tag, invoiceID, secret }) {
    const rawTx = await this.signTransaction({ address, amount, passphrase, tag, invoiceID, secret });
    const txHash = await this.sendRawTransaction({ rawTx });
    return txHash;
  }

  async signTransaction({ address, amount, tag, invoiceID, secret }) {
    if (!secret) {
      const err = new Error('Secret not provided');
      err.conclusive = true; // used by server
      throw err;
    }

    /**
     * Generates wallet & returns it if Account exists
     * @param {string} seed 
     * @param {xrpl.ECDSA} algorithm
     * 
     * @returns {Promise<xrpl.Wallet>}
     * @throws {xrpl.XrplError} - If the account does not exist (data.error_code = 19)
     */
    const getWalletFromSeedAndConfirmAccount = async (seed, algorithm = xrpl.ECDSA.ed25519) => {
      const wallet = xrpl.Wallet.fromSeed(seed, { algorithm });
      await this.asyncRequest('account_info', { account: wallet.address });
      return wallet;
    };

    let wallet;
    try {
      wallet = await getWalletFromSeedAndConfirmAccount(secret);
    } catch (err) {
      wallet = await getWalletFromSeedAndConfirmAccount(secret, xrpl.ECDSA.secp256k1);
    }

    /** @type {xrpl.SubmittableTransaction} */
    const payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: xrpl.xrpToDrops(amount),
      Destination: address
    };
    if (tag) {
      payment.DestinationTag = tag;
    }
    if (invoiceID) {
      payment.InvoiceID = invoiceID;
    }
    const prepared = await this.asyncCall('autofill', payment);
    const signed = wallet.sign(prepared);
    return signed.tx_blob;
  }

  async sendRawTransactionMany({ rawTxArray }) {
    let resultArray = [];
    for (const rawTx of rawTxArray) {
      const emitData = { rawTx };
      try {
        let txHash = await this.sendRawTransaction({ rawTx });
        emitData.txid = txHash;
        resultArray.push(emitData);
        this.emitter.emit('success', emitData);
      } catch (e) {
        emitData.error = e;
        resultArray.push(emitData);
        this.emitter.emit('failure', emitData);
      }
    }
    return resultArray;
  }

  async unlockAndSendToAddressMany({ payToArray, secret }) {
    if (secret === undefined) {
      secret = await passwordPromptAsync('> ');
    }

    const resultArray = [];

    for (const payment of payToArray) {
      const { address, amount, id } = payment;
      const emitData = { address, amount, id };
      this.emitter.emit('attempt', emitData);
      try {
        const txid = await this.sendToAddress({ address, amount, secret });
        emitData.txid = txid;
        resultArray.push(emitData);
        this.emitter.emit('success', emitData);

        // do not await confirmations, the submitted txs are pending not confirmed
      } catch (e) {
        emitData.error = e;
        resultArray.push(emitData);
        this.emitter.emit('failure', emitData);
      }
    }
    return resultArray;
  }

  async getRawTransaction({ txid }) {
    try {
      /** @type {AccountTransactionBinaryResult} */
      const result = (await this.asyncRequest('tx', { transaction: txid, binary: true })).result;
      return result.tx_blob;
    } catch (err) {
      if (err && err.data && err.data.error === 'txnNotFound') {
        return null;
      }
      throw err;
    }
  }

  // todo
  async sendRawTransaction({ rawTx }) {
    /** @type {xrpl.SubmitResponse} */
    const response = await this.asyncCall('submit', rawTx);
    const result = response.result;
    const { accepted, engine_result_message, tx_json } = result;
    if (accepted) {
      return tx_json.hash;
    } else {
      throw new Error(engine_result_message);
    }
  }

  async decodeRawTransaction({ rawTx }) {
    // likely {xrpl.Payment}
    /** @type {xrpl.BaseTransaction} */
    const txJSON = xrpl.decode(rawTx);

    if (txJSON.TxnSignature) {
      txJSON.hash = xrpl.hashes.hashSignedTx(rawTx);
    }

    return txJSON;
  }

  async estimateFee() {
    const response = await this.asyncRequest('fee');
    /** @type {xrpl.FeeResponse['result']} */
    const result = response.result; // NOTE - result is missing expected max_queue_size
    return result.drops.minimum_fee;
  }

  async getBalance({ address }) {
    /** @type {number} integer */
    const balance = await this.asyncCall('getXrpBalance', address || this.address);
    return parseFloat(balance);
  }

  async getBestBlockHash() {
    let tip = await this.getTip();
    return tip.hash;
  }

  /**
   * @returns {Promise<xrpl.TxResponse['result']['tx_json'] & {confirmations: number; blockHash: string}>}
   */
  async getTransaction({ txid }) {
    try {
      /** @type {xrpl.TxResponse} */
      const response = await this.asyncRequest('tx', { transaction: txid });
      const result = response.result;
      if (!result || !result.validated) {
        return null;
      }
      // Append Confirmations
      if (!result.ledger_index) {
        result.confirmations = 0;
      } else {
        let tip = await this.getTip();
        let height = tip.height;
        result.confirmations = height - result.ledger_index + 1; // Tip is considered confirmed
      }
      // Append BlockHash
      /** @type {xrpl.LedgerResponse['result']} */
      const txBlock = (await this.asyncRequest('ledger', { ledger_index: result.ledger_index })).result;
      result.blockHash = txBlock.ledger_hash;
      return result;
    } catch (err) {
      if (err && err.data && err.data.error === 'txnNotFound') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get all transactions for an account
   * @param {string} address Account to get transactions for
   * @param {object} options See https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_tx/
   * @returns {xrpl.AccountTxResponse['result']}
   */
  async getTransactions({ address, options }) {
    try {
      await this.asyncRequest('account_info', { account: address }); // In xrpl v4, account_tx does not error on unfound account

      /** @type {xrpl.AccountTxResponse} */
      const { result } = await this.asyncRequest('account_tx', { account: address, ...options });
      return result;
    } catch (err) {
      if (err && err.data && err.data.error === 'actNotFound') {
        return [];
      }
      throw err;
    }
  }

  async getBlock({ hash, index, transactions = true, expand = true } = {}) {
    try {
      if (index === 'latest') {
        index = 'validated';
      }
      let result;
      if (hash) {
        ({ result } = await this._getBlockByHash({ hash, transactions, expand }));
      } else {
        ({ result } = await this._getBlockByIndex({ index, transactions, expand }));
      }
      return result;
    } catch (err) {
      if (err && err.data && err.data.error === 'lgrNotFound') {
        return null;
      }
      throw err;
    }
  }

  /**
   * @returns {Promise<xrpl.LedgerResponse>}
   * note: queue_data may not be included on result
   */
  async _getBlockByHash({ hash, transactions = true, expand = true }) {
    return this.asyncRequest('ledger', {
      ledger_hash: hash,
      transactions,
      expand
    });
  }

  /**
   * @returns {Promise<xrpl.LedgerResponse>}
   * note: queue_data may not be included on result
   */
  async _getBlockByIndex({ index = 'validated', transactions = true, expand = true }) {
    return this.asyncRequest('ledger', {
      ledger_index: index,
      transactions,
      expand
    });
  }

  async getConfirmations({ txid }) {
    return (await this.getTransaction({ txid })).confirmations;
  }

  async getTip() {
    /** @type {xrpl.LedgerResponse} */
    const response = await this.asyncRequest('ledger', {
      ledger_index: 'validated'
    });
    const { ledger_index: height, ledger_hash: hash } = response.result;
    return { height, hash };
  }

  async getTxOutputInfo() {
    return null;
  }

  async validateAddress({ address }) {
    return xrpl.isValidAddress(address);
  }

  /**
   * @return {xrpl.ACcountInfoResponse['result']}
   * will not include ledger_index or queue_data
   */
  async getAccountInfo({ address }) {
    try {
      /** @type {xrpl.AccountInfoResponse} */
      const response = await this.asyncRequest('account_info', { account: address });
      return response.result;
    } catch (error) {
      if (error.data && error.data.error && error.data.error === 'actNotFound') {
        error.conclusive = true;
      }
      throw error;
    }
  }

  /**
   * @returns {xrpl.ServerInfoResponse['result']['info']}
   */
  async getServerInfo() {
    const { result } = await this.asyncRequest('server_info');
    return result.info;
  }
}

module.exports = XrpRpc;

/**
 * @typedef {Object} AccountTransactionBinaryResult
 * @property {string} hash - Transaction hash
 * @property {string} tx_blob - Transaction blob
 * @property {boolean} validated - Indicates if the transaction is validated
 */