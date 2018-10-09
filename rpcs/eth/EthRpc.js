const Web3 = require('web3');
var promptly = require('promptly');

class EthRPC {
  constructor(config) {
    this.config = config;
    this.web3 = this.getWeb3(config);
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
    let accounts = await this.web3.eth.getAccounts();
    const address = accounts[0];
    try {
      await this.web3.eth.sign('', address);
    } catch (e) {
      return false;
    }
    return true;
  }

  async cmdlineUnlock(time, cb) {
    try {
      let accounts = await this.web3.eth.getAccounts();
      let account = accounts[0];
      const unlocked = await this.isUnlocked();
      promptly.password('> ', async (err, phrase) => {
        if (err) { return cb(err); }
        await this.web3.eth.personal.unlockAccount(account, phrase, time);
        cb(null, this.walletLock);
        // await this.walletLock();
      });
    } catch (e) {
      return cb(e);
    }
  }


  async getBalance(address, cb) {
    if(address) {
      const balance = await this.web3.eth.getBalance(address);
      if(cb){
        return cb(null, balance);
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
      if(cb) {
        return cb(null, balances);
      } else {
        return balances;
      }
    }
  }

  async sendToAddress(address, amount, cb) {
    try {
      const accounts = await this.web3.eth.getAccounts();
      return this.web3.eth.sendTransaction({
        from: accounts[0],
        to: address,
        value: amount
      }).then(cb);
    } catch (e) {
      return cb(e);
    }
  }

  async walletLock(cb) {
    let accounts = await this.web3.eth.getAccounts();
    let account = accounts[0];
    await this.web3.eth.personal.lockAccount(account);
  }
}
module.exports = EthRPC;
