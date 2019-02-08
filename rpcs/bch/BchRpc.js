const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  estimateFee(nBlocks, cb) {
    this.rpc.estimateFee(nBlocks, cb);
  }

  getBestBlockHash(cb) {
    this.rpc.getBestBlockHash(cb);
  }
}
module.exports = BchRpc;
