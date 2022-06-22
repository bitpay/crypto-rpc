const RpcClasses = {
  BTC: require('./btc/BtcRpc'),
  BCH: require('./bch/BchRpc'),
  ETH: require('./eth/EthRpc'),
  XRP: require('./xrp/XrpRpc'),
  DOGE: require('./doge/DogeRpc'),
  LTC: require('./ltc/LtcRpc'),
  LNBTC: require('./lnd/LndRpc'),
  MATIC: require('./matic/MaticRpc'),
};

const TokenClasses = {
  ETH: {
    native: require('./eth/EthRpc'),
    ERC20: require('./erc20/Erc20Rpc')
  },
  MATIC: {
    native: require('./matic/MaticRpc'),
    ERC20_m: require('./erc20/Erc20Rpc')
  },
  BTC: {
    native: require('./btc/BtcRpc')
  },
  BCH: {
    native: require('./bch/BchRpc')
  },
  XRP: {
    native: require('./xrp/XrpRpc')
  },
  DOGE: {
    native: require('./doge/DogeRpc')
  },
  LTC: {
    native: require('./ltc/LtcRpc')
  },
  LNBTC: {
    native: require('./lnd/LndRpc')
  }
};

class CryptoRpcProvider {
  constructor(config) {
    this.chain = config.chain;
    if (!RpcClasses[this.chain]) {
      throw new Error('Invalid chain specified');
    }
    this.config = Object.assign({}, config, {
      host: config.host,
      port: config.port || config.rpcPort,
      user: config.user || config.rpcUser,
      pass: config.pass || config.rpcPass,
      protocol: config.protocol
    });
    this.rpcs = {
      [this.chain]: new RpcClasses[this.chain](this.config)
    };
    if (config.tokens) {
      Object.entries(config.tokens).forEach(([token, tokenConfig]) => {
        const TokenClass = TokenClasses[this.chain][tokenConfig.type];
        const configForToken = Object.assign(tokenConfig, this.config);
        this.rpcs[token] = new TokenClass(configForToken);
      });
    }
  }

  has(currency) {
    return !!this.rpcs[currency];
  }

  get(currency = this.chain) {
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

  getBlockHash(params) {
    return this.get(params.currency).getBlockHash(params);
  }

  getConfirmations(params) {
    return this.get(params.currency).getConfirmations(params);
  }

  getTip(params) {
    return this.get(params.currency).getTip(params);
  }

  getTxOutputInfo(params) {
    return this.get(params.currency).getTxOutputInfo(params);
  }

  validateAddress(params) {
    return this.get(params.currency).validateAddress(params);
  }

  getAccountInfo(params) {
    return this.get(params.currency).getAccountInfo(params);
  }
}

module.exports = CryptoRpcProvider;
