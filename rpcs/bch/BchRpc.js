const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  estimateFee(nBlocks, cb) {
    this.rpc.estimateFee(nBlocks, cb);
  }
}
module.exports = BchRpc;
