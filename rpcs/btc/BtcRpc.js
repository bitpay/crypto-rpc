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

  walletLock(cb) {
    this.rpc.walletLock(cb);
  }

  getBalance(address, cb) {
    this.rpc.getWalletInfo(cb);
  }
}

module.exports = BtcRpc;
