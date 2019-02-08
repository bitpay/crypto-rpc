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
      ERC20: Erc20RPC,
      GUSD: Erc20RPC,
      USDC: Erc20RPC,
      PAX: Erc20RPC
    };

    this.config = {
      host: rpcConfig.host,
      port: rpcConfig.rpcPort,
      user: rpcConfig.user || rpcConfig.rpcUser,
      pass: rpcConfig.pass || rpcConfig.rpcPass,
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

  sendToAddress(currency, address, amount, cb, passphrase) {
    this.get(currency).sendToAddress(address, amount, cb, passphrase);
  }

  walletLock(currency, cb) {
    this.get(currency).walletLock(cb);
  }

  unlockAndSendToAddress(currency, address, amount, callback, passphrase) {
    this.get(currency).unlockAndSendToAddress(address, amount, callback, passphrase);
  }

  estimateFee(currency, nBlocks, cb) {
    this.get(currency).estimateFee(nBlocks, cb);
  }

  getBestBlockHash(currency, cb) {
    this.get(currency).getBestBlockHash(cb);
  }
}

module.exports = CryptoRpcProvider;
