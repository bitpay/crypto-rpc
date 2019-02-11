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
    const timeHex = this.web3.utils.toHex(time);
    try {
      promptly.password('> ', async (err, phrase) => {
        if (err) { return callback(err); }
        await this.web3.eth.personal.unlockAccount(this.account, phrase, timeHex);
        console.log(this.account, ' unlocked for ' + time + ' seconds');
        return callback(null, (doneLocking) => {
          this.walletLock((err) => {
            if (err) {
              console.log(err.message);
            } else {
              console.log('wallet locked');
            }
            doneLocking && doneLocking();
          });
        });
      });
    } catch (e) {
      return callback(e);
    }
  }


  async getBalance(address, callback) {
    try {
      if (address) {
        const balance = await this.web3.eth.getBalance(address);
        if (callback) {
          return callback(null, balance);
        } else {
          return balance;
        }
      } else {
        const accounts = await this.web3.eth.getAccounts();
        const balances = [];
        for (let account of accounts) {
          const balance = await this.web3.eth.getBalance(account);
          balances.push({ account,  balance });
        }
        if (callback) {
          return callback(null, balances);
        } else {
          return balances;
        }
      }
    } catch (err) {
      if (callback) {
        return callback(err);
      }
    }
  }

  async sendToAddress(address, amount, callback, passphrase) {
    try {
      const gasPrice = await this.estimateGasPrice();
      this.web3.eth.personal.sendTransaction({
        from: this.account,
        to: address,
        value: amount,
        gasPrice
      }, passphrase, (err, result) => {
        callback(err, { result });
      });
    } catch(e) {
      return callback(e);
    }
  }

  async unlockAndSendToAddress(address, amount, callback, passphrase) {
    const send = (phrase) => {
      console.log('Unlocking for a single transaction.');
      this.sendToAddress(address, amount, callback, passphrase);
    }
    try {
      if(!passphrase) {
        promptly.password('> ', (err, phrase) => {
          send(phrase);
        })
      } else {
        send(passphrase);
      }
    } catch (err) {
      if (callback) {
        return callback(err);
      }
    }
  }

  async getBestBlockHash(callback) {
    const bestBlock = await this.web3.eth.blockNumber;
    const blockHash = await this.web3.eth.getBlock(bestBlock).hash;

    if(callback) callback(null, blockHash);
    return blockHash
  }

  estimateFee(nBlocks, cb) {
    return this.estimateGasPrice(nBlocks).then((value) => {
      if(cb) cb(null, value);
      return value;
    }).catch((err) => {
      if(cb) cb(err);
      cb(err);
    });
  }

  async estimateGasPrice(nBlocks = 4) {
    const bestBlock = this.web3.eth.blockNumber;
    const gasPrices = [];
    for(let i = bestBlock; i > bestBlock - nBlocks; i--) {
      const block = this.web3.eth.getBlock(i);
      const txs = block.transactions.map((txid) => {
        return this.web3.eth.getTransaction(txid);
      });
      var blockGasPrices = txs.map((tx) => { return tx.gasPrice });
      // sort gas prices in descending order
      blockGasPrices = blockGasPrices.sort((a, b) => { return b - a });
      var txCount = txs.length;
      var lowGasPriceIndex = txCount > 1 ? txCount - 2 : 0;
      if(txCount > 0) {
        gasPrices.push(blockGasPrices[lowGasPriceIndex]);
      }
    }
    var gethGasPrice = await this.web3.eth.getGasPrice();
    var estimate = gasPrices.reduce((a, b) => {
      return Math.max(a, b);
    }, gethGasPrice);
    return estimate;
  }

  async walletLock(callback) {
    try {
      await this.web3.eth.personal.lockAccount(this.account);
      return callback();
    } catch (err) {
      if (callback) {
        return callback(err);
      }
    }
  }
}
module.exports = EthRPC;
