const LitecoinRPC = require('bitcoind-rpc');
const BtcRpc = require('../btc/BtcRpc');
class LtcRpc extends BtcRpc {
  constructor(config) {
    super(config);
    const {
      rpcPort: port,
      rpcUser: user,
      rpcPass: pass,
      host,
      protocol
    } = config;
    this.rpc = new LitecoinRPC({ host, port, user, pass, protocol });
  }
}
module.exports = LtcRpc;
