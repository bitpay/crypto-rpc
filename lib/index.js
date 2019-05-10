const RpcClasses = {
  BTC: require('./btc/BtcRpc'),
  BCH: require('./bch/BchRpc'),
  ETH: require('./eth/EthRpc')
};

const TokenClasses = {
  ETH: {
    native: require('./eth/EthRpc'),
    ERC20: require('./erc20/Erc20Rpc')
  },
  BTC: {
    native: require('./btc/BtcRpc')
  },
  BCH: {
    native: require('./bch/BchRpc')
  }
};

class CryptoRpcProvider {
  constructor(config) {
    this.rpcs = {};
    for(const chain of Object.keys(config)) {
      const chainConfig = config[chain];
      const rpcConfig = Object.assign({}, chainConfig,  {
        host: chainConfig.host,
        port: chainConfig.port || chainConfig.rpcPort,
        user: chainConfig.user || chainConfig.rpcUser,
        pass: chainConfig.pass || chainConfig.rpcPass,
        protocol: chainConfig.protocol
      });
      this.rpcs[chain] = new RpcClasses[chain](rpcConfig);

      if (chainConfig.tokens) {
        for(const [token, tokenConfig] of Object.entries(chainConfig.tokens)) {
          const TokenClass = TokenClasses[chain][tokenConfig.type];
          const configForToken = Object.assign(tokenConfig, rpcConfig);
          this.rpcs[token] = new TokenClass(configForToken);
        }
      }
    }
  }

  has(currency) {
    return !!this.rpcs[currency];
  }

  get(currency) {
    if(!this.has(currency)) {
      throw new Error('No RPC for currency: ' + currency);
    }
    return this.rpcs[currency];
  }

  cmdlineUnlock(params) {
    return this.get(params.currency).cmdlineUnlock(params);
  }

  getBalance(params) {
    return this.get(params.currency).getBalance(params);
  }

  sendToAddress(params) {
    return this.get(params.currency).sendToAddress(params);
  }

  walletLock(params) {
    return this.get(params.currency).walletLock(params);
  }

  unlockAndSendToAddress(params) {
    return this.get(params.currency).unlockAndSendToAddress(params);
  }

  unlockAndSendToAddressMany(params) {
    return this.get(params.currency).unlockAndSendToAddressMany(params);
  }

  estimateFee(params) {
    return this.get(params.currency).estimateFee(params);
  }

  getBestBlockHash(params) {
    return this.get(params.currency).getBestBlockHash(params);
  }

  getTransaction(params) {
    return this.get(params.currency).getTransaction(params);
  }

  getTransactionCount(params) {
    return this.get(params.currency).getTransactionCount(params);
  }

  getRawTransaction(params) {
    return this.get(params.currency).getRawTransaction(params);
  }

  sendRawTransaction(params) {
    return this.get(params.currency).sendRawTransaction(params);
  }

  decodeRawTransaction(params) {
    return this.get(params.currency).decodeRawTransaction(params);
  }

  getBlock(params) {
    return this.get(params.currency).getBlock(params);
  }

  getConfirmations(params) {
    return this.get(params.currency).getConfirmations(params);
  }

  getTip(params) {
    return this.get(params.currency).getTip(params);
  }

  validateAddress(params) {
    return this.get(params.currency).validateAddress(params);
  }
}

module.exports = CryptoRpcProvider;
