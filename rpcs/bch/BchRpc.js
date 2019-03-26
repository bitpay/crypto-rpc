const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  async estimateFee({ nBlocks }) {
    const feeRate = await this.asyncCall('estimateFee', [nBlocks]);
    return feeRate * 1e8;
  }
}
module.exports = BchRpc;
