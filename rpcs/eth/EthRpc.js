const Web3 = require('web3');
var promptly = require('promptly');

class EthRPC {
  constructor(config) {
    this.config = config;
    this.web3 = this.getWeb3(config);
    this.account = config.currencyConfig.account;
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
    if (!Provider) { throw new Error('Please provide a valid protocol'); }
    return new Web3(new Provider(connectionString));
  }

  async isUnlocked() {
    try {
      await this.web3.eth.sign('',  this.account);
    } catch (err) {
      return false;
    }
    return true;
  }

  async cmdlineUnlock(time, callback) {
    try {
      const unlocked = await this.isUnlocked();
      const phrase = await promptly.password('> ');
      await this.web3.eth.personal.unlockAccount(this.account, phrase, time);
      return callback(null, this.walletLock.bind(this));
    } catch (err) {
      console.error(err);
      return callback(err);
    }
  }


  async getBalance(address, callback) {
    if(address) {
      const balance = await this.web3.eth.getBalance(address);
      if(callback){
        return callback(null, balance);
      } else {
        return balance;
      }
    } else {
      const accounts = await this.web3.eth.getAccounts();
      const balances = [];
      for(let account of accounts) {
        const balance = await this.web3.eth.getBalance(account);
        balances.push({ account,  balance });
      }
      if(callback) {
        return callback(null, balances);
      } else {
        return balances;
      }
    }
  }

  async sendToAddress(address, amount, callback) {
    try {
      const tx = await this.web3.eth.sendTransaction({
        from: this.account,
        to: address,
        value: amount
      });
      return callback(null, { result: tx.transactionHash });
    } catch (err) {
      return callback(err);
    }
  }

  async walletLock(callback) {
    await this.web3.eth.personal.lockAccount(this.account);
    if(callback) {
      return callback();
    }
  }
}
module.exports = EthRPC;
