var BitcoinRPC = require('./bitcoin');

class BtcRpc {
  constructor(config) {
    this.rpc = new BitcoinRPC(config);
  }

  cmdlineUnlock(time, cb) {
    this.rpc.cmdlineUnlock(time, cb);
  }

  sendToAddress(address, amount, cb) {
    this.rpc.sendToAddress(address, amount, cb);
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


  walletLock(cb) {
    this.rpc.walletLock(cb);
  }

  estimateFee(nBlocks, cb) {
    this.rpc.estimateSmartFee(nBlocks, cb);
  }

  getBalance(address, cb) {
    this.rpc.getWalletInfo(cb);
  }
}

module.exports = BtcRpc;
