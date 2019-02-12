const Web3 = require('web3');
var promptly = require('promptly');
const EthereumTx = require('ethereumjs-tx');


class EthRPC {
  constructor(config) {
    this.config = config;
    this.web3 = this.getWeb3(config);
    this.account = config.currencyConfig.account || this.web3.eth.accounts[0];
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
        console.warn(this.account, ' unlocked for ' + time + ' seconds');
        return callback(null, (doneLocking) => {
          this.walletLock((err) => {
            if (err) {
              console.error(err.message);
            } else {
              console.warn('wallet locked');
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
      const sendParams = {
        from: this.account,
        to: address,
        value: amount,
        gasPrice
      };
      const result = await this.web3.eth.personal.sendTransaction(sendParams, passphrase);
      if(callback) {
        callback(null, result);
      }
      return result;
    }
    catch(e) {
      console.error(e);
      if(callback) {
        callback(e);
      }
    }
  }

  async unlockAndSendToAddress(address, amount, callback, passphrase) {
    const send = (phrase) => {
      console.warn('Unlocking for a single transaction.');
      return this.sendToAddress(address, amount, callback, phrase);
    };
    try {
      if(passphrase === undefined) {
        return promptly.password('> ', (err, phrase) => {
          return send(phrase);
        });
      } else {
        return send(passphrase);
      }
    } catch (err) {
      console.error(err);
      if (callback) {
        return callback(err);
      }
    }
  }


  estimateFee(nBlocks, cb) {
    return this.estimateGasPrice(nBlocks).then((value) => {
      if(cb) cb(null, value);
      return value;
    }).catch((err) => {
      if(cb) cb(err);
    });
  }

  async estimateGasPrice(nBlocks = 4) {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const gasPrices = [];
    for(let i = 0; i < nBlocks; i++) {
      const block = await this.web3.eth.getBlock(bestBlock - i);
      const txs = await Promise.all(block.transactions.map((txid) => {
        return this.web3.eth.getTransaction(txid);
      }));
      var blockGasPrices = txs.map((tx) => { return tx.gasPrice; });
      // sort gas prices in descending order
      blockGasPrices = blockGasPrices.sort((a, b) => { return b - a; });
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

  async getBestBlockHash(callback) {
    const bestBlock = await this.web3.eth.getBlockNumber();
    const block = await this.web3.eth.getBlock(bestBlock);
    const blockHash = block.hash;

    if(callback) callback(null, blockHash);
    return blockHash;
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


  async getTransaction(txid, callback) {
    if(callback) {
      return this.web3.eth.getTransaction(txid, callback);
    } else {
      return this.web3.eth.getTransaction(txid);
    }
  }

  async getRawTransaction(txid, callback) {
    return new Promise((resolve, reject) => {
      this.web3.currentProvider.send({method: 'getRawTransaction', args: [txid]}, (err, data) => {
        if(callback) return callback(err, data);
        if(err) {
          return reject(err);
        }
        resolve(data);
      });
    });
  }

  async decodeRawTransaction(rawTx, cb) {
    const tx = new EthereumTx(rawTx);
    const to = '0x' + tx.to.toString('hex');
    const from = '0x' + tx.from.toString('hex');
    const value= parseInt(tx.value.toString('hex') || '0', 16);
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
    if(cb) cb(null, decodedData);
    return decodedData;
  }

  async getBlock(blockHash, cb) {
    return this.web3.eth.getBlock(blockHash, cb);
  }

  async getConfirmations(txid, cb) {
    try {
      const tx = await this.getTransaction(txid);
      const bestBlock = await this.web3.eth.getBlockNumber();
      if(tx.blockNumber === undefined) {
        if(cb) cb(null, 0);
        return 0;
      }
      const confirmations = (bestBlock - tx.blockNumber) + 1;
      if(cb) cb(confirmations);
      return confirmations;
    } catch (err) {
      if(cb) cb(err);
    }
  }
}
module.exports = EthRPC;
