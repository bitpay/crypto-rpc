const BtcRpc = require('../btc/BtcRpc');
class BchRpc extends BtcRpc {
  async estimateFee() {
    const feeRate = await this.asyncCall('estimateFee', []);
    const satoshisPerKb = Math.round(feeRate * 1e8);
    const satoshisPerByte = satoshisPerKb / 1e3;
    return satoshisPerByte;
  }

  async getBlockHash({height}) {
    return this.asyncCall('getBlockHash', [height]);
  }
}
module.exports = BchRpc;
