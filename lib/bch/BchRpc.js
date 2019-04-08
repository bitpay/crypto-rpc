const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  async estimateFee({ nBlocks }) {
    const feeRate = await this.asyncCall('estimateFee', [nBlocks]);
    const scale = 1e3;
    const scaledFeeRate = Math.round(feeRate * 1e8);
    return scaledFeeRate / scale;
  }
}
module.exports = BchRpc;
