const { Web3 } = require('web3');
const promptly = require('promptly');
const ethers = require('ethers');
const util = require('util');
const EventEmitter = require('events');
const chainConfig = require('./chains');
const utils = require('../utils');

const { toBI } = utils;

const passwordPromptAsync = util.promisify(promptly.password);
const setTimeoutAsync = util.promisify(setTimeout);

class EthRPC {
  constructor(config) {
    this.config = config;
    this.chain = this.config.chain;
    this.web3 = this.getWeb3(this.config);
    this.account = this.config.account;
    this.emitter = new EventEmitter();
    this.blockCache = new Map();
    this.blockGasPriceCache = new Map();
    this.blockMaxPriorityFeeCache = new Map();
  }

  getWeb3(web3Config) {
    const { protocol, host, port, options } = web3Config;
    const connectionString =  port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
    let Provider = null;
    switch (protocol) {
      case 'http':
        Provider = Web3.providers.HttpProvider;
        break;
      case 'https':
        Provider = Web3.providers.HttpProvider;
        break;
      case 'ws':
        Provider = Web3.providers.WebsocketProvider;
        break;
      case 'wss':
        Provider = Web3.providers.WebsocketProvider;
        break;
    }
    if (!Provider) {
      throw new Error('Please provide a valid protocol');
    }
    return new Web3(new Provider(connectionString, options || {}));
  }

  /**
   * @deprecated 
   */
  async isUnlocked() {
    try {
      const account = await this.getAccount();
      await this.web3.eth.sign('', account);
    } catch (err) {
      return false;
    }
    return true;
  }

  addAccount(privateKey) {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    this.web3.eth.accounts.wallet.add(account);
    this.account = account.address;
    return account.address;
  }

  getAccount() {
    if (this.account) {
      return this.account;
    }
    return this.web3.eth.accounts.wallet[0]?.address;
  }

  removeAccount(address) {
    address = this.web3.utils.toChecksumAddress(address);
    this.web3.eth.accounts.wallet.remove(address);
    if (this.account === address) {
      this.account = null;
    }
  }

  #getWallet(account) {
    return this.web3.eth.accounts.wallet.get(account);
  }

  #addWallet(privateKey) {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    const accountExists = !!this.#getWallet(account);
    if (!accountExists) {
      this.addAccount(privateKey);
    }
    return [account.address, !accountExists];
  }

  /**
   * @deprecated
   * @param {Object} params
   * @param {number} params.time
   */
  async cmdlineUnlock({ time }) {
    const timeHex = this.web3.utils.toHex(time);
    const passphrase = await passwordPromptAsync(' >');
    const account = this.getAccount();
    await this.web3.eth.personal.unlockAccount(account, passphrase, timeHex);
    this.emitter.emit('unlocked');
    console.warn(account, ' unlocked for ' + time + ' seconds');
  }

  /**
   * @deprecated
   */
  async walletLock() {
    const account = await this.getAccount();
    return this.web3.eth.personal.lockAccount(account);
  }

  async getBalance({ address }) {
    if (address) {
      const balance = await this.web3.eth.getBalance(address);
      return balance;
    } else {
      const wallets = await this.web3.eth.accounts.wallet;
      const balances = [];
      for (const wallet of wallets) {
        const balance = await this.web3.eth.getBalance(wallet.address);
        balances.push({ account: wallet.address, balance });
      }
      return balances;
    }
  }

  async sendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas }) {
    if (!gasPrice) {
      gasPrice = await this.estimateGasPrice();
    }
    const account = fromAccount || this.getAccount();
    const amountStr = Number(amount).toLocaleString('fullwide', { useGrouping: false });
    const sendParams = {
      from: account,
      to: address,
      value: amountStr,
      gasPrice,
      nonce,
      gas
    };

    if (!gas) {
      const estimatedGas = await this.web3.eth.estimateGas(sendParams);
      sendParams.gas = estimatedGas; 
    }

    if (nonce == null) {
      sendParams.nonce = await this.getTransactionCount({ address: account });
    }

    const wallet = this.#getWallet(account);
    if (!wallet) {
      throw new Error('Account not found. Make sure you add it first with addAccount()');
    }

    try {
      const signed = await wallet.signTransaction(sendParams);
      const txid = await new Promise((resolve, reject) => 
        this.web3.eth.sendSignedTransaction(signed.rawTransaction).on('transactionHash', resolve).on('error', reject)
      );

      return txid;
    } catch (error) {
      throw new Error(error);
    }
  }

  async unlockAndSendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas }) {
    let accountAdded = true;
    if (typeof fromAccount === 'string' && (fromAccount.length === 66 || fromAccount.length === 64)) {
      [fromAccount, accountAdded] = this.#addWallet(fromAccount);
    }
    try {
      const txid = await this.sendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas });
      return txid;
    } finally {
      accountAdded && this.removeAccount(fromAccount);
    }
  }

  async unlockAndSendToAddressMany({ payToArray, fromAccount, gasPrice, nonce, gas }) {
    let accountAdded = true;
    if (typeof fromAccount === 'string' && (fromAccount.length === 66 || fromAccount.length === 64)) {
      [fromAccount, accountAdded] = this.#addWallet(fromAccount);
    }

    try {
      const resultArray = [];
      for (const payment of payToArray) {
        const { address, amount, id } = payment;
        const emitData = { address, amount, id };
        this.emitter.emit('attempt', emitData);
        try {
          const txid = await this.sendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas });
          emitData.txid = txid;
          resultArray.push(emitData);
          this.emitter.emit('success', emitData);

          let confirmations = 0;
          let timeout = new Date().getTime() + 120000;
          while (!confirmations || confirmations < 1) {
            if (new Date().getTime() > timeout) {
              this.emitter.emit('timeout', emitData);
              break;
            }

            await setTimeoutAsync(1000);
            confirmations = await this.getConfirmations({ txid });
          }
        } catch (error) {
          emitData.error = error;
          resultArray.push(emitData);
          this.emitter.emit('failure', emitData);
        }
      }

      this.emitter.emit('done');
      return resultArray;
    } finally {
      accountAdded && this.removeAccount(fromAccount);
    }
  }

  /**
   * Estimates the fee for a transaction.
   * @param {Object} params - The parameters for estimating the fee.
   * @param {number} params.nBlocks - The number of blocks to consider for the estimation.
   * @param {string} [params.txType='0'] - The type of transaction fee estimation. '2' or 'eip-1559' style, '0' or 'legacy'.
   * @param {number} [params.percentile] - Optional: For type 2 txs, The priority fee percentile from last block to use for the estimation.
   * @param {number} [params.priority] - Optional: For type 2 txs, The priority fee to be used with the baseFee.
   * @returns {Promise<number>} The estimated fee. If txType is '2', returns the sum of maxFee and priorityFee. Otherwise, returns a number.
   */
  async estimateFee({ nBlocks, txType = '0', priority, percentile }) {
    const _txType = txType.toString().toLowerCase();
    switch (_txType) {
      case 'eip-1559':
      case '2':
        // defaults to 2 * base fee + prioity fee (2.5 gwei) uses priority fee value or percentile if set
        return await this.estimateMaxFee({ percentile, priority });
      case 'legacy':
      case '0':
      default:
        return await this.estimateGasPrice(nBlocks);
    }
  }

  /**
   * Estimates the fee.
   * @param {Object} params - The parameters for estimating the fee.
   * @param {Map} params.cache - The cache of block fees.
   * @param {number|BigInt} params.defaultEstimate - The default fee value.
   * @param {number} [params.percentile=25] - The percentile to use for the estimation.
   * @param {Function} params.getFees - The function to get the fees from the blocks.
   * @returns {Promise<BigInt>} The estimated fee.
   */
  async _estimateFee({ cache, defaultEstimate, percentile = 25, getFees }) {
    defaultEstimate = toBI(defaultEstimate);

    const blocks = await this._getRecentBlocks({});
    const percentileFees = this._getPercentileFees({ percentile, blocks, cache, getFees });
    if (!percentileFees.length) {
      return defaultEstimate;
    }
    const estimate = this._calculateFeeEstimate(percentileFees);
    return utils.BI.max(estimate, defaultEstimate);
  }

  /**
   * Estimates the gas price.
   * @returns {Promise<number>} The estimated gas price.
   */
  async estimateGasPrice() {
    const defaultEstimate = await this.web3.eth.getGasPrice();
    return this._estimateFee({
      cache: this.blockGasPriceCache,
      defaultEstimate,
      percentile: 25,
    });
  }

  /**
   * Estimates the maximum base fee. Defaults to 2 * baseFee + 2.5 gwei.
   * @param {Object} params - The parameters for estimating the maximum base fee.
   * @param {number} [params.percentile] - Optional: The maxPriorityFee percentile from last block to use for the estimation.
   * @param {number} [params.priority] - Optional: The maxPriorityFee to be used with the baseFee.
   * @returns {number|BigInt} The estimated maximum base fee.
   */
  async estimateMaxFee({ percentile, priority }) {
    const lastBlock = await this.web3.eth.getBlock('latest');
    const baseFeePerGas = lastBlock.baseFeePerGas || 0n;
    const gwei = BigInt(this.web3.utils.toWei('1', 'gwei'));

    if (priority > 0) {
      // user defined priority fee
      return 2n * baseFeePerGas + (BigInt(priority) * gwei);
    }
    if (percentile > 0 && percentile <= 100) {
      // percentile priority fee
      const maxPriorityFee = await this.estimateMaxPriorityFee({ percentile });
      return 2n * baseFeePerGas + maxPriorityFee;
    }
    // default max fee formula. ensures inclusion in next block
    return 2n * baseFeePerGas + BigInt(this.web3.utils.toWei('2.5', 'gwei'));
  }

  /**
   * Estimates the maximum priority fee.
   * @param {Object} params - The parameters for estimating the maximum priority fee.
   * @param {number} [params.percentile=25] - The percentile to use for the estimation.
   * @returns {Promise<number>} The estimated maximum priority fee.
   */
  async estimateMaxPriorityFee({ percentile = 25 }) {
    const minimumFee = chainConfig[this.chain] ? chainConfig[this.chain].priorityFee : 2.5;
    const defaultEstimate = parseInt(this.web3.utils.toWei(String(minimumFee), 'gwei'));
    const getFees = (_txs) => _txs
      .filter((tx) => !!tx.maxPriorityFeePerGas)
      .map((tx) => parseInt(tx.maxPriorityFeePerGas));
    return this._estimateFee({
      cache: this.blockMaxPriorityFeeCache,
      defaultEstimate,
      percentile,
      getFees,
    });
  }

  /**
   * Fetches the last n blocks from the blockchain.
   * @param {Object} params - The parameters for fetching the blocks.
   * @param {number} [params.n=10] - The number of blocks to fetch.
   * @returns {Promise<Array>} The fetched blocks.
   */
  async _getRecentBlocks({ n = 10 }) {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const cache = this.blockCache;
    const blocks = await Promise.all(
      [...Array(n).keys()].map(async (n) => {
        const targetBlockNumber = bestBlock - BigInt(n);
        if (cache && cache.has(targetBlockNumber)) {
          return cache.get(targetBlockNumber);
        }
        const block = await this.web3.eth.getBlock(targetBlockNumber, true);
        if (!block) {
          throw new Error(`Unable to fetch block ${targetBlockNumber}`);
        }
        if (cache) {
          cache.set(targetBlockNumber, block);
          if (cache.size > n) {
            cache.delete(Array.from(cache.keys()).sort((a, b) => Number(BigInt(a) - BigInt(b)))[0]);
          }
        }
        return block;
      })
    ).catch((err) => { 
      this.emitter.emit('failure', err);
      return [];
    });
    return blocks;
  }

  /**
   * Gets the percentile fees for the given blocks.
   * @param {Object} params - The parameters for getting the percentile fees.
   * @param {number} [params.percentile=25] - The percentile to get the fees for.
   * @param {Array} params.blocks - The blocks to get the fees from.
   * @param {Map} params.cache - The cache to use for storing the fees.
   * @param {Function} params.getFees - The function to use for getting the fees from the transactions.
   * @returns {Array} The percentile fees for the given blocks.
   */
  _getPercentileFees({ percentile = 25, blocks, cache, getFees }) {
    const percentileKey = `percentile${percentile}`;
    let fees = [];
    for (const block of blocks) {
      if (!block || !block.number || (!block.transactions || !block.transactions.length)) {
        continue;
      }

      let percentileValue;
      // get percentile fee
      if (cache && cache.has(block.number) && cache.get(block.number)[percentileKey]) {
        percentileValue = cache.get(block.number)[percentileKey];
      } else {
        const _fees = getFees ? getFees(block.transactions) : block.transactions.map((tx) => tx.gasPrice);
        const feesSorted = utils.BI.sortDesc(_fees);
        percentileValue = feesSorted[Math.floor(feesSorted.length * (percentile / 100)) - Math.floor(percentile / 100)];
      }
      if (percentileValue == null) {
        continue;
      }
      // set quick fee retrieval cache
      if (cache) {
        let blockFees = cache.has(block.number) ? cache.get(block.number) : {};
        blockFees[percentileKey] = percentileValue;
        cache.set(block.number, blockFees);
        if (cache.size > 9) {
          cache.delete(Array.from(cache.keys()).sort((a, b) => Number(a - b))[0]);
        }
      }
      fees.push(percentileValue);
    }
    return fees;
  }

  /**
   * Calculates the fee estimate.
   * @param {Array<BigInt>} fees - The fees to calculate the estimate from.
   * @returns {BigInt} The calculated fee estimate.
   */
  _calculateFeeEstimate(fees) {
    // const shortAverage = Math.ceil(fees
    //   .slice(0, fees.length / 2)
    //   .reduce((acc, cur) => acc + cur, 0) / (fees.length / 2)
    // );
    const shortAverage = utils.BI.avgCeil(fees.slice(0, fees.length / 2));
    // const longAverage = Math.ceil(fees
    //   .reduce((acc, cur) => acc + cur, 0) / fees.length);
    const longAverage = utils.BI.avgCeil(fees);
    const divergence = utils.BI.abs(shortAverage - longAverage);
    return utils.BI.max(shortAverage, longAverage) + divergence;
  }

  async getBestBlockHash() {
    const block = await this.web3.eth.getBlock('latest');
    const blockHash = block.hash;
    return blockHash;
  }

  async getTransaction({ txid, getConfirmations = false }) {
    const tx = await this.web3.eth.getTransaction(txid);
    if (!getConfirmations || !tx) {
      return tx;
    }
    const bestBlock = (await this.web3.eth.getBlock())?.number;
    tx.confirmations = tx.blockNumber != null ? bestBlock - tx.blockNumber + 1n : 0;
    return tx;
  }

  /**
   * Gets pending transactions in the node's mempool
   * @returns {Array}
   */
  async getTransactions() {
    return await this.web3.eth.getPendingTransactions();
  }

  async getTransactionCount({ address, defaultBlock }) {
    return await this.web3.eth.getTransactionCount(address, defaultBlock);
  }

  async getRawTransaction({ txid }) {
    return new Promise((resolve, reject) => {
      this.web3.currentProvider.request(
        { method: 'getRawTransaction', args: [txid] },
        (err, data) => {
          if (err) {
            return reject(err);
          }
          resolve(data);
        }
      );
    });
  }

  sendRawTransaction({ rawTx }) {
    return new Promise((resolve, reject) => {
      const errorHandler = (err) => {
        if (err && err.message && (err.message.includes('already imported') || err.message.includes('already known'))) {
          const txData = this.decodeRawTransaction({ rawTx });
          return resolve(txData.txid);
        }
        reject(err);
      };
      this.web3.eth
        .sendSignedTransaction(rawTx)
        .once('transactionHash', resolve)
        .once('error', errorHandler)
        .catch(errorHandler);
    });
  }

  decodeRawTransaction({ rawTx }) {
    const decodedTx = ethers.Transaction.from(rawTx);
    const {
      to,
      from,
      nonce,
      hash,
      value,
      type,
      gasPrice,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      data
    } = decodedTx;

    return {
      to: to ? to.toLowerCase() : undefined,
      from: from ? from.toLowerCase() : undefined,
      nonce: nonce,
      txid: hash,
      value: value,
      type: type || undefined,
      gasPrice: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      maxFeePerGas: maxFeePerGas,
      gasLimit: gasLimit,
      data
    };
  }

  async getBlock({ hash }) {
    return await this.web3.eth.getBlock(hash);
  }

  async getConfirmations({ txid }) {
    const tx = await this.getTransaction({ txid, getConfirmations: true });
    if (!tx) {
      return null;
    }
    return tx.confirmations;
  }

  async getTip() {
    const block = await this.web3.eth.getBlock('latest');
    const { hash, number } = block;
    return { height: number, hash };
  }

  async getTxOutputInfo() {
    return null;
  }

  async validateAddress({ address }) {
    return await this.web3.utils.isAddress(address);
  }

  async isSyncing() {
    return await this.web3.eth.isSyncing();
  }

  getAccountInfo() {
    return {};
  }

  getServerInfo() {
    return this.web3.eth.getNodeInfo();
  }
}
module.exports = EthRPC;
