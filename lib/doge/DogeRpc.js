const BtcRpc = require('../btc/BtcRpc');
class DogeRpc extends BtcRpc {
  async estimateFee() {
    const feeRate = await this.asyncCall('estimateFee', []);
    const satoshisPerKb = Math.round(feeRate * 1e8);
    const satoshisPerByte = satoshisPerKb / 1e3;
    return satoshisPerByte;
  }
}
module.exports = DogeRpc;
