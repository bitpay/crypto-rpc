const EventEmitter = require('events');
const EthRpc = require('../eth/EthRpc');

class MaticRpc extends EthRpc {
  super(config) {
    this.config = config;
    this.web3 = this.getWeb3(this.config);
    this.account = this.config.account;
    this.emitter = new EventEmitter();
  }
}
module.exports = MaticRpc;
