var BitcoinRPC = require('./bitcoin');

class BtcRpc {
  constructor(config) {
    this.rpc = new BitcoinRPC(config);
  }

  asyncCall(method, args, cb) {
    if(cb) {
      return this.rpc[method](...args, (err, resp) => {
        if(err) {
          return cb(err);
        }
        cb(null, resp.result);
      });
    }
    return new Promise((resolve, reject) => {
      this.rpc[method](...args, (err, resp) => {
        if(err || (resp && resp.result && resp.result.errors)){
          reject(err);
        } else {
          resolve(resp.result);
        }
      });
    });
  }

  async cmdlineUnlock(time, cb) {
    return this.asyncCall("cmdlineUnlock", [time], cb);
  }

  async sendToAddress(address, amount, cb) {
    return this.asyncCall("sendToAddress", [address, amount], cb);
  }

  async unlockAndSendToAddress(address, amount, callback, passphrase) {
    this.cmdlineUnlock(10, (err, lock) => {
      if(err) return callback(err);
      this.sendToAddress(address, amount, (err, tx) => {
        if(err) return callback(err);
        this.walletLock((lockErr) => {
          if(lockErr) {
            console.error('Unable to lock wallet', lockErr);
          } else {
            console.log('Wallet locked');
          }
          callback(err, tx);
        });
      });
    });
  }


  async walletLock(cb) {
    return this.asyncCall("walletLock", [], cb);
  }

  async estimateFee(nBlocks, cb) {
    return this.asyncCall("estimateSmartFee", [nBlocks], cb);
  }

  async getBalance(address, cb) {
    const balanceInfo = await this.asyncCall("getWalletInfo", [], cb);
    return balanceInfo.balance;
  }

  async getBestBlockHash(cb) {
    return this.asyncCall("getBestBlockHash", [], cb);
  }

  async getTransaction(txid, cb) {
    return this.asyncCall("getTransaction", [txid], cb);
  }

  async getRawTransaction(txid, cb) {
    return this.asyncCall("getRawTransaction", [txid], cb);
  }

  async decodeRawTransaction(rawTx, cb) {
    return this.asyncCall('decodeRawTransaction', [rawTx], cb);
  }

  async getBlock(hash, cb) {
    return this.asyncCall('getBlock', [hash], cb);
  }

  async getConfirmations(txid, cb) {
    try {
      const blockHeight = await this.getTransaction(txid);
      const blockHash = await this.getBestBlockHash();
      const block = await this.getBlock(blockHash);
      const confirmations = block.height - blockHeight;
      if(cb) cb(null, confirmations);
      return confirmations;
    } catch (err) {
      if(cb) cb(err);
    }
  }
}

module.exports = BtcRpc;
