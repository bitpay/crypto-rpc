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
  }

  getWeb3(web3Config) {
    const { protocol, host, port } = web3Config;
    const connectionString = `${protocol}://${host}:${port}`;
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

  async sendToAddress({ address, amount, fromAccount, passphrase }) {
    const gasPrice = await this.estimateGasPrice();
    const account = fromAccount || await this.getAccount();
    const amountStr = Number(amount).toLocaleString('fullwide', {useGrouping:false});
    const sendParams = {
      from: account,
      to: address,
      value: amountStr,
      gasPrice
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

  async unlockAndSendToAddress({ address, amount, fromAccount, passphrase }) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    const tx = await this.sendToAddress({ address, amount, fromAccount, passphrase });
    return tx;
  }

  async unlockAndSendToAddressMany({ payToArray, passphrase, fromAccount }) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }

    const resultArray = [];
    for (const payment of payToArray) {
      const { address, amount, id } = payment;
      const emitData = { address, amount, id };
      this.emitter.emit('attempt', emitData);
      try {
        const txid = await this.sendToAddress({ address, amount, fromAccount, passphrase });
        emitData.txid = txid;
        resultArray.push(emitData);
        this.emitter.emit('success', emitData);

        await new Promise(async (resolve, reject) => {
          try {
            let confirmations = 0;
            while (!confirmations || confirmations < 1) {
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

  async estimateGasPrice() {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const blocks = await Promise.all([...Array(10).keys()]
      .map((n) => {
        return this.web3.eth.getBlock(bestBlock - n, 1);
      }));
    let medianGasPrices = [];
    for (const block of blocks) {
      const gasPrices = block.transactions.map(tx => parseInt(tx.gasPrice)).sort();
      const median = gasPrices[[Math.floor(block.transactions.length / 2)]];
      medianGasPrices.push(median);
    }
    const shortAverage = medianGasPrices.slice(0, medianGasPrices.length/2).reduce((acc, cur) => acc + cur, 0) / (medianGasPrices.length / 2);
    const longAverage = medianGasPrices.reduce((acc, cur) => acc + cur, 0) / medianGasPrices.length;
    const divergence = shortAverage - longAverage;
    const estimate = (divergence < 0)? shortAverage: shortAverage + divergence;
    const rpcEstimate = await this.web3.eth.getGasPrice();
    return Math.max(estimate, parseInt(rpcEstimate));
  }

  async getBestBlockHash() {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const block = await this.web3.eth.getBlock(bestBlock);
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
    tx.confirmations = tx.blockNumber !== undefined ? bestBlock - tx.blockNumber + 1 : 0;
    return tx;
  }

  async getTransactionCount({ address }) {
    return this.web3.eth.getTransactionCount(address);
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
    return this.web3.eth.sendSignedTransaction(rawTx);
  }

  async decodeRawTransaction({ rawTx }) {
    const tx = new EthereumTx(rawTx);
    const to = '0x' + tx.to.toString('hex');
    const from = '0x' + tx.from.toString('hex');
    const value = parseInt(tx.value.toString('hex') || '0', 16);
    const gasPrice = parseInt(tx.gasPrice.toString('hex'), 16);
    const gasLimit = parseInt(tx.gasLimit.toString('hex'), 16);
    const data = tx.data.toString('hex');
    const decodedData = {
      to,
      from,
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
    const height = await this.web3.eth.getBlockNumber();
    const block = await this.web3.eth.getBlock(height);
    const { hash } = block;
    return { height, hash };
  }

  async validateAddress({ address }) {
    return await this.web3.utils.isAddress(address);
  }
}
module.exports = EthRPC;
