var BTCRpc = require('./btc/BtcRpc');
var BCHRpc = require('./bch/BchRpc');
var EthRPC = require('./eth/EthRpc');
var Erc20RPC = require('./erc20/Erc20Rpc');
class CryptoRpcProvider {
  constructor(rpcConfig, currencyConfig) {
    this.rpcClasses = {
      BTC: BTCRpc,
      BCH: BCHRpc,
      ETH: EthRPC,
      GUSD: Erc20RPC,
      USDC: Erc20RPC,
      PAX: Erc20RPC
    };

    this.config = {
      host: rpcConfig.host,
      port: rpcConfig.rpcPort,
      user: rpcConfig.rpcUser,
      pass: rpcConfig.rpcPass,
      protocol: rpcConfig.protocol,
      currencyConfig
    };
  }

  has(currency) {
    return this.rpcClasses[currency] != null;
  }

  get(currency) {
    const RpcClass = this.rpcClasses[currency];
    return new RpcClass(this.config);
  }

  cmdlineUnlock(currency, time, cb) {
    this.get(currency).cmdlineUnlock(time, cb);
  }

  getBalance(currency, address, cb) {
    this.get(currency).getBalance(address, cb);
  }

  sendToAddress(currency, address, amount, cb) {
    this.get(currency).sendToAddress(address, amount, cb);
  }

  walletLock(currency, cb) {
    this.get(currency).walletLock(cb);
  }
}

module.exports = CryptoRpcProvider;
