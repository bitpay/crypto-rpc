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
    this.blockFeeCache = new Map();
    // for the above single fee map would need to create
    // a fee object with fields for gasPrice, baseFee, and priorityFee
    this.blockGasPriceCache = new Map();
    this.blockBaseFeeCache = new Map();
    this.blockPriorityFeeCache = new Map();
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

  estimateFee({ nBlocks }) {
    return this.estimateGasPrice(nBlocks);
  }

  _estimateFee(cache, rpcEstimate, getFeesFn){
    const blocks = this._getBestBlocks(cache);
    const percentile25GasPrices = this._getPercentile25(blocks, this.blockGasPriceCache, getFeesFn);
    if (!percentile25GasPrices.length) {
      return rpcEstimate;
    }
    const estimate = this._calculateFeeEstimate(percentile25GasPrices);
    return Math.max(estimate, rpcEstimate);
  }

  async estimateGasPrice() {
    const rpcEstimate = parseInt(await this.web3.eth.getGasPrice());
    return _estimateFee(this.blockGasPriceCache, rpcEstimate);
  }

  async estimateBaseFee({ nBlocks }) {
    const latestBlock = await web3.eth.getBlock('latest');
    const rpcEstimate = latestBlock.baseFeePerGas ? parseInt(latestBlock.baseFeePerGas) : 0;
    const getFees = (_blocks) => _blocks.filter(tx => !!tx.maxFeePerGas
      ).map(tx => parseInt(tx.maxFeePerGas));    
    return _estimateFee(this.blockBaseFeeCache, rpcEstimate, getFees);
  }

  async estimatePriorityFee({ nBlocks }) {
    // default to 1 gwei
    const rpcEstimate = parseInt(web3.utils.toWei('1', 'gwei'));
    const getFees = (_blocks) => _blocks.filter(tx => !!tx.maxPriorityFeePerGas
      ).map(tx => parseInt(tx.maxPriorityFeePerGas));
    return _estimateFee(this.blockPriorityFeeCache, rpcEstimate, getFees);
  }

  async _getBestBlocks(cache, n = 10) {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const blocks = await Promise.all([...Array(n).keys()]
      .map((n) => {
        let targetBlockNumber = bestBlock - n;
        if (cache && cache.has(targetBlockNumber)) {
          return cache.get(targetBlockNumber);
        }
        return this.web3.eth.getBlock(targetBlockNumber, 1);
      }));
    return blocks;
  }

  _getPercentile25(blocks, cache, getFees) {
    let percentile25 = [];
    for (const block of blocks) {
      if (!block || (!block.percentile25 && (!block.transactions || !block.transactions.length)) ) {
        continue;
      }

      let percentile25;
      if (block.percentile25) {
        percentile25 = block.percentile25;
      } else {
        const gasValues = getFees ? 
          getFees(block.transactions) : 
          block.transactions.map(parseInt(tx.gasPrice));
        const gasValuesSorted = gasValues.sort((a, b) => b - a);
        percentile25 = gasValuesSorted[Math.floor(block.transactions.length / 4)];  
      }
      if (cache && block.number) {
        cache.set(block.number, { percentile25 });
        if (cache.size > 9) {
          cache.delete(Array.from(cache.keys()).sort()[0]);
        }
      }
      percentile25.push(percentile25);
    }
    return percentile25;
  }

  _calculateFeeEstimate(percentile25) {
    const shortAverage = Math.ceil(percentile25.slice(0, percentile25.length / 2).reduce((acc, cur) => acc + cur, 0) / (percentile25.length / 2));
    const longAverage = Math.ceil(percentile25.reduce((acc, cur) => acc + cur, 0) / percentile25.length);
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
