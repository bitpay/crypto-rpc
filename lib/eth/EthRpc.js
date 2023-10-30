const Web3 = require('web3');
const promptly = require('promptly');
const EthereumTx = require('ethereumjs-tx');
const util = require('util');
const EventEmitter = require('events');

const passwordPromptAsync = util.promisify(promptly.password);
const setTimeoutAsync = util.promisify(setTimeout);

class EthRPC {
  constructor(config) {
    this.config = config;
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
      case 'ipc':
        Provider = Web3.providers.IpcProvider;
        break;
    }
    if (!Provider) {
      throw new Error('Please provide a valid protocol');
    }
    if (protocol !== 'ipc') return new Web3(new Provider(connectionString, options || {}));
    return new Web3(new Provider(connectionString));
  }

  async isUnlocked() {
    try {
      const account = await this.getAccount();
      await this.web3.eth.sign('', account);
    } catch (err) {
      return false;
    }
    return true;
  }

  async getAccount() {
    if (this.account) {
      return this.account;
    }
    const accounts = await this.web3.eth.getAccounts();
    return accounts[0];
  }

  async cmdlineUnlock({ time }) {
    const timeHex = this.web3.utils.toHex(time);
    const passphrase = await passwordPromptAsync(' >');
    const account = await this.getAccount();
    await this.web3.eth.personal.unlockAccount(account, passphrase, timeHex);
    this.emitter.emit('unlocked');
    console.warn(account, ' unlocked for ' + time + ' seconds');
  }

  async getBalance({ address }) {
    if (address) {
      const balance = await this.web3.eth.getBalance(address);
      return balance;
    } else {
      const accounts = await this.web3.eth.getAccounts();
      const balances = [];
      for (let account of accounts) {
        const balance = await this.web3.eth.getBalance(account);
        balances.push({ account, balance });
      }
      return balances;
    }
  }

  async sendToAddress({ address, amount, fromAccount, passphrase, gasPrice, nonce, gas }) {
    if (!gasPrice) {
      gasPrice = await this.estimateGasPrice();
    }
    const account = fromAccount || await this.getAccount();
    const amountStr = Number(amount).toLocaleString('fullwide', { useGrouping: false });
    const sendParams = {
      from: account,
      to: address,
      value: amountStr,
      gasPrice,
      nonce,
      gas
    };

    if (passphrase) {
      this.emitter.emit('unlockedForOne');
    }

    try {
      const result = await this.web3.eth.personal.sendTransaction(
        sendParams,
        passphrase
      );

      if (passphrase) {
        this.emitter.emit('locked');
      }

      return result;
    } catch (error) {
      this.emitter.emit('locked');
      throw new Error(error);
    }
  }

  async unlockAndSendToAddress({ address, amount, fromAccount, passphrase, gasPrice, nonce, gas }) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    const tx = await this.sendToAddress({ address, amount, fromAccount, passphrase, gasPrice, nonce, gas });
    return tx;
  }

  async unlockAndSendToAddressMany({ payToArray, passphrase, fromAccount, gasPrice, nonce, gas }) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }

    const resultArray = [];
    for (const payment of payToArray) {
      const { address, amount, id } = payment;
      const emitData = { address, amount, id };
      this.emitter.emit('attempt', emitData);
      try {
        const txid = await this.sendToAddress({ address, amount, fromAccount, passphrase, gasPrice, nonce, gas });
        emitData.txid = txid;
        resultArray.push(emitData);
        this.emitter.emit('success', emitData);

        await new Promise(async (resolve, reject) => {
          try {
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

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }  catch (error) {
        emitData.error = error;
        resultArray.push(emitData);
        this.emitter.emit('failure', emitData);
      }
    }

    this.emitter.emit('done');
    return resultArray;
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
   * @param {number} params.rpcEstimate - The RPC estimate of the fee.
   * @param {number} [params.percentile=25] - The percentile to use for the estimation.
   * @param {Function} params.getFees - The function to get the fees from the blocks.
   * @returns {Promise<number>} The estimated fee.
   */
  async _estimateFee({ cache, rpcEstimate, percentile = 25, getFees }) {
    const blocks = await this._getRecentBlocks({});
    const percentileFees = this._getPercentileFees({ percentile, blocks, cache, getFees });
    if (!percentileFees.length) {
      return rpcEstimate;
    }
    const estimate = this._calculateFeeEstimate(percentileFees);
    return Math.max(estimate, rpcEstimate);
  }

  /**
   * Estimates the gas price.
   * @returns {Promise<number>} The estimated gas price.
   */
  async estimateGasPrice() {
    const rpcEstimate = parseInt(await this.web3.eth.getGasPrice());
    return this._estimateFee({
      cache: this.blockGasPriceCache,
      rpcEstimate,
      percentile: 25,
    });
  }

  /**
   * Estimates the maximum base fee. Defaults to 2 * baseFee + 2.5 gwei.
   * @param {Object} params - The parameters for estimating the maximum base fee.
   * @param {number} [params.percentile] - Optional: The maxPriorityFee percentile from last block to use for the estimation.
   * @param {number} [params.priority] - Optional: The maxPriorityFee to be used with the baseFee.
   * @returns {number} The estimated maximum base fee.
   */
  async estimateMaxFee({ percentile,  priority }) {
    const lastBlock = await this.web3.eth.getBlock('latest');    
    const baseFeePerGas = parseInt(lastBlock.baseFeePerGas) ? parseInt(lastBlock.baseFeePerGas) : 0;
    const gwei = parseInt(this.web3.utils.toWei('1', 'gwei'));

    if (priority && parseInt(priority) > 0) {
      // user defined priority fee
      return 2 * baseFeePerGas + (priority * gwei);
    }
    if (percentile && parseInt(percentile) > 0 && parseInt(percentile) <= 100) {
      // percentile priority fee
      const maxPriorityFee = await this.estimateMaxPriorityFee({ percentile });
      return 2 * baseFeePerGas + maxPriorityFee;
    }
    // default max fee formmula. ensures inclusion in next block
    return 2 * baseFeePerGas + (2.5 * gwei); 
  }

  /**
   * Estimates the maximum priority fee.
   * @param {Object} params - The parameters for estimating the maximum priority fee.
   * @param {number} [params.percentile=25] - The percentile to use for the estimation.
   * @returns {Promise<number>} The estimated maximum priority fee.
   */
  async estimateMaxPriorityFee({ percentile = 25 }) {
    const rpcEstimate = parseInt(this.web3.utils.toWei('2.5', 'gwei'));
    const getFees = (_txs) => _txs
      .filter((tx) => !!tx.maxPriorityFeePerGas)
      .map((tx) => parseInt(tx.maxPriorityFeePerGas));
    return this._estimateFee({
      cache: this.blockMaxPriorityFeeCache,
      rpcEstimate,
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
    let cache = this.blockCache;
    let blocks = await Promise.all(
      [...Array(n).keys()].map(async (n) => {
        const targetBlockNumber = bestBlock - n;
        if (cache && cache.has(targetBlockNumber)) {
          return cache.get(targetBlockNumber);
        }
        const block = await this.web3.eth.getBlock(targetBlockNumber, 1);
        if(!block) {
          throw new Error(`Unable to fetch block ${targetBlockNumber}`);
        }
        if (cache) {
          cache.set(targetBlockNumber, block);
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
        const _fees = getFees ? getFees(block.transactions) : block.transactions.map((tx) => parseInt(tx.gasPrice));
        const feesSorted = _fees.sort((a, b) => b - a);
        percentileValue = feesSorted[Math.floor(feesSorted.length * (percentile / 100))];
      }
      if(!Number.isInteger(percentileValue)) { 
        continue;
      }
      // set quick fee retrieval cache
      if (cache) {
        let blockFees = cache.has(block.number) ? cache.get(block.number) : {};
        blockFees[percentileKey] = percentileValue;
        cache.set(block.number, blockFees);
        if (cache.size > 9) {
          cache.delete(Array.from(cache.keys()).sort()[0]);
        }
      }
      fees.push(percentileValue);
    }
    return fees;
  }

  /**
   * Calculates the fee estimate.
   * @param {Array} fees - The fees to calculate the estimate from.
   * @returns {number} The calculated fee estimate.
   */
  _calculateFeeEstimate(fees) {
    const shortAverage = Math.ceil(fees
      .slice(0, fees.length / 2)
      .reduce((acc, cur) => acc + cur, 0) / (fees.length / 2)
    );
    const longAverage = Math.ceil(fees
      .reduce((acc, cur) => acc + cur, 0) / fees.length);
    const divergence = Math.abs(shortAverage - longAverage);
    return Math.max(shortAverage, longAverage) + divergence;
  }

  async getBestBlockHash() {
    const block = await this.web3.eth.getBlock('latest');
    const blockHash = block.hash;
    return blockHash;
  }

  async walletLock() {
    const account = await this.getAccount();
    return this.web3.eth.personal.lockAccount(account);
  }

  async getTransaction({ txid, getConfirmations = false }) {
    const tx = await this.web3.eth.getTransaction(txid);
    if (!getConfirmations || !tx) {
      return tx;
    }
    const bestBlock = await this.web3.eth.getBlockNumber();
    tx.confirmations = (tx.blockNumber || tx.blockNumber === 0) ? bestBlock - tx.blockNumber + 1 : 0;
    return tx;
  }

  async getTransactionCount({ address, defaultBlock }) {
    return this.web3.eth.getTransactionCount(address, defaultBlock);
  }

  async getRawTransaction({ txid }) {
    return new Promise((resolve, reject) => {
      this.web3.currentProvider.send(
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
          const tx = new EthereumTx(rawTx);
          const txid = '0x' + tx.hash().toString('hex');
          return resolve(txid);
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

  async decodeRawTransaction({ rawTx }) {
    const tx = new EthereumTx(rawTx);
    const to = '0x' + tx.to.toString('hex');
    let from;
    try {
      from = '0x' + tx.from.toString('hex');
    } catch (error) {
      from = undefined;
    }
    let txid;
    if (from) {
      txid = '0x' + tx.hash().toString('hex');
    }
    const value = parseInt(tx.value.toString('hex') || '0', 16);
    const gasPrice = parseInt(tx.gasPrice.toString('hex'), 16);
    const gasLimit = parseInt(tx.gasLimit.toString('hex'), 16);
    const nonce = parseInt(tx.nonce.toString('hex'), 16);
    const data = tx.data.toString('hex');
    const decodedData = {
      to,
      from,
      nonce,
      txid,
      value,
      gasPrice,
      gasLimit,
      data
    };
    return decodedData;
  }

  getBlock({ hash }) {
    return this.web3.eth.getBlock(hash);
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
}
module.exports = EthRPC;
