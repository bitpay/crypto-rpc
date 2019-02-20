const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  estimateFee({ nBlocks }) {
    return this.asyncCall('estimateFee', [nBlocks]);
  }
}
module.exports = BchRpc;
