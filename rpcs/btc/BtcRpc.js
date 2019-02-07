var BitcoinRPC = require('./bitcoin');

class BtcRpc {
  constructor(config) {
    this.rpc = new BitcoinRPC(config);
  }

  asyncCall(method, args, cb) {
    return new Promise((resolve, reject) => {
      this.rpc[method](...args, (err, resp) => {
        if(err || (resp && resp.result && resp.result.errors)){
          reject(err);
          if(cb) return cb(err);
        } else {
          resolve(resp);
          if(cb) return cb(null, resp);
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
            console.error('Unable to lock wallet');
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
    return balanceInfo.result.balance;
  }
}

module.exports = BtcRpc;
