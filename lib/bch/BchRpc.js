const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  async estimateFee({ nBlocks }) {
    const feeRate = await this.asyncCall('estimateFee', [nBlocks]);
    const satoshisPerKb = Math.round(feeRate * 1e8);
    const satoshisPerByte = satoshisPerKb / 1e3;
    return satoshisPerByte;
  }
}
module.exports = BchRpc;
