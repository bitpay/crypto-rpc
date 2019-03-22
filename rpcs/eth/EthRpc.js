const Web3 = require('web3');
var promptly = require('promptly');
const EthereumTx = require('ethereumjs-tx');

class EthRPC {
  constructor(config) {
    this.config = config;
    this.web3 = this.getWeb3(this.config);
    this.account = this.config.account || this.web3.eth.accounts[0];
  }

  getWeb3(web3Config) {
    const { protocol, host, port } = web3Config;
    const connectionString = `${protocol}://${host}:${port}`;
    let Provider = null;
    switch (protocol) {
      case 'http':
        Provider = Web3.providers.HttpProvider;
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
      await this.web3.eth.sign('', this.account);
    } catch (err) {
      return false;
    }
    return true;
  }

  async cmdlineUnlock({ time }) {
    const timeHex = this.web3.utils.toHex(time);
    promptly.password('> ', async (err, phrase) => {
      if (err) {
        throw err;
      }
      await this.web3.eth.personal.unlockAccount(
        this.account,
        phrase,
        timeHex
      );
      console.warn(this.account, ' unlocked for ' + time + ' seconds');
    });
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

  async sendToAddress({ address, amount, passphrase }) {
    const gasPrice = await this.estimateGasPrice();
    const sendParams = {
      from: this.account,
      to: address,
      value: amount,
      gasPrice
    };
    const result = await this.web3.eth.personal.sendTransaction(
      sendParams,
      passphrase
    );
    return result;
  }

  async unlockAndSendToAddress({ address, amount, passphrase }) {
    return new Promise((resolve, reject) => {
      const send = async passphrase => {
        console.warn('Unlocking for a single transaction.');
        try {
          const tx = await this.sendToAddress({ address, amount, passphrase });
          resolve(tx);
        } catch (err) {
          reject(err);
        }
      };
      if (passphrase === undefined) {
        return promptly.password('> ', (err, phrase) => {
          if (err) {
            return reject(err);
          }
          return send(phrase);
        });
      } else {
        return send(passphrase);
      }
    });
  }

  estimateFee({ nBlocks }) {
    return this.estimateGasPrice(nBlocks);
  }

  async estimateGasPrice({ nBlocks = 4 } = {}) {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const gasPrices = [];
    for (let i = 0; i < nBlocks; i++) {
      const block = await this.web3.eth.getBlock(bestBlock - i);
      const txs = await Promise.all(
        block.transactions.map(txid => {
          return this.web3.eth.getTransaction(txid);
        })
      );
      var blockGasPrices = txs.map(tx => {
        return tx.gasPrice;
      });
      // sort gas prices in descending order
      blockGasPrices = blockGasPrices.sort((a, b) => {
        return b - a;
      });
      var txCount = txs.length;
      var lowGasPriceIndex = txCount > 1 ? txCount - 2 : 0;
      if (txCount > 0) {
        gasPrices.push(blockGasPrices[lowGasPriceIndex]);
      }
    }
    var gethGasPrice = await this.web3.eth.getGasPrice();
    var estimate = gasPrices.reduce((a, b) => {
      return Math.max(a, b);
    }, gethGasPrice);
    return estimate;
  }

  async getBestBlockHash() {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const block = await this.web3.eth.getBlock(bestBlock);
    const blockHash = block.hash;
    return blockHash;
  }

  walletLock() {
    return this.web3.eth.personal.lockAccount(this.account);
  }

  getTransaction({ txid }) {
    return this.web3.eth.getTransaction(txid);
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
    const tx = await this.getTransaction({ txid });
    if (!tx) {
      return null;
    }
    const bestBlock = await this.web3.eth.getBlockNumber();
    if (tx.blockNumber === undefined) {
      return 0;
    }
    const confirmations = bestBlock - tx.blockNumber + 1;
    return confirmations;
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
