const RippleAPI = require('ripple-lib').RippleAPI;
const rippleBinaryCodec = require('ripple-binary-codec');
const promptly = require('promptly');
const util = require('util');
const EventEmitter = require('events');
const rippleHashes = require('ripple-hashes');

const passwordPromptAsync = util.promisify(promptly.password);

class XrpRpc {
  constructor(config) {
    this.config = config;
    const {
      rpcPort,
      host,
      protocol,
      address,
      timeout
    } = config;
    const connectionString = `${protocol}://${host}:${rpcPort}`;
    this.rpc = new RippleAPI({
      server: connectionString,
      timeout: timeout || 30000
    });
    this.address = address;
    this.emitter = new EventEmitter();
    this.connectionHandled = false;
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

    let result;
    if (args) {
      result = await this.rpc[method](...args);
    } else {
      result = await this.rpc[method]();
    }
    return result;
  }

  async asyncRequest(method, args) {
    // Wrap args in array here, since `request` always takes one options object
    return this.asyncCall('request', [method, args]);
  }

  async unlockAndSendToAddress({ address, amount, secret }) {
    if (secret === undefined) {
      secret = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    return await this.sendToAddress({ address, amount, secret });
  }

  async sendToAddress({ address, amount, passphrase, tag, invoiceID, secret }) {
    let rawTx = await this.signTransaction({ address, amount, passphrase, tag, invoiceID, secret });
    let txHash = await this.sendRawTransaction({ rawTx });
    return txHash;
  }

  async signTransaction({ address, amount, tag, invoiceID, secret }) {
    if (!secret) {
      const err = new Error('Secret not provided');
      err.conclusive = true; // used by server
      throw err;
    }
    let sourceAddress = await this.asyncCall('deriveAddress', [this.rpc.deriveKeypair(secret).publicKey]);
    const payment = {
      source: {
        address: sourceAddress,
        tag: tag || undefined,
        maxAmount: {
          value: amount.toString(),
          currency: this.config.currency
        }
      },
      destination: {
        address: address,
        tag: tag || undefined,
        amount: {
          value: amount.toString(),
          currency: this.config.currency
        }
      },
      invoiceID: invoiceID || undefined
    };
    let prepared = await this.asyncCall('preparePayment', [sourceAddress, payment]);
    const { signedTransaction } = await this.asyncCall('sign', [prepared.txJSON, secret]);
    return signedTransaction;
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
    let { tx } = await this.asyncRequest('tx', [{ transaction: txid, binary: true }]);
    return tx;
  }

  async sendRawTransaction({ rawTx }) {
    try {
      let response = await this.asyncCall('submit', [rawTx]);
      if (response.resultCode !== 'tesSUCCESS') {
        const err = new Error('Failed to submit transaction: ' + response.resultMessage);
        err.conclusive = true; // used by server
        throw err;
      }
      return response.tx_json.hash;
    } catch (err) {
      this.emitter.emit('error', { error: err });
      throw err;
    }
  }

  async decodeRawTransaction({ rawTx }) {
    let txid = rippleHashes.computeBinaryTransactionHash(rawTx);
    let txJSON = rippleBinaryCodec.decode(rawTx);
    txJSON.hash = txid;
    return txJSON;
  }

  async estimateFee() {
    let xrpFee = await this.asyncCall('getFee');
    // Need to scale fee so it is in 'drops'
    return this.rpc.xrpToDrops(xrpFee);
  }

  async getBalance({ address }) {
    let balance =  await this.asyncCall('getBalances', [this.address || address]);
    let balanceAmount = balance.find(b => (b.currency === 'XRP'));
    let val = balanceAmount ? balanceAmount.value : 0;
    return parseFloat(val);
  }

  async getBestBlockHash() {
    let tip = await this.getTip();
    return tip.hash;
  }

  async getTransaction({ txid }) {
    const tx = await this.asyncRequest('tx', { transaction: txid });
    if (!tx) {
      return null;
    }
    // Append Confirmations
    if (!tx.ledger_index) {
      tx.confirmations = 0;
    } else {
      let tip = await this.getTip();
      let height = tip.height;
      tx.confirmations = height - tx.ledger_index + 1; // Tip is considered confirmed
    }
    // Append BlockHash
    const txBlock = await this.asyncRequest('ledger', { ledger_index: tx.ledger_index });
    tx.blockHash = txBlock.ledger_hash;
    return tx;
  }

  async getBlock({ hash }) {
    return this.asyncRequest('ledger', {
      ledger_hash: hash,
      transactions: true
    });
  }

  async getConfirmations({ txid }) {
    return (await this.getTransaction({ txid })).confirmations;
  }

  async getTip() {
    const blockchainInfo = await this.asyncRequest('ledger', {
      ledger_index: 'validated'
    });
    let height = blockchainInfo.ledger_index;
    let hash = blockchainInfo.ledger_hash;
    return { height, hash };
  }

  async validateAddress({ address }) {
    return this.rpc.isValidAddress(address);
  }
}

module.exports = XrpRpc;
