const rpcClasses = {
  BTC: require('./btc/BtcRpc'),
  BCH: require('./bch/BchRpc'),
  ETH: require('./eth/EthRpc')
};

const tokensClasses = {
  ETH: {
    ERC20: require('./erc20/Erc20Rpc')
  },
  BTC: {},
  BCH: {}
};

class CryptoRpcProvider {
  constructor(config) {
    this.chain = config.chain;
    if (!rpcClasses[this.chain]) {
      throw new Error('Invalid chain specified');
    }
    this.config = {
      host: config.host,
      port: config.rpcPort,
      user: config.user || config.rpcUser,
      pass: config.pass || config.rpcPass,
      protocol: config.protocol
    };
    this.rpcs = {
      [this.chain]: new rpcClasses[this.chain](this.config)
    };
    Object.entries(config.tokens).forEach((token, tokenConfig) => {
      this.rpcs[token] = new tokensClasses[this.chain][token](Object.assign(tokenConfig, this.config));
    });
  }

  has(currency) {
    return !!this.rpcs[currency];
  }

  get(currency=this.chain) {
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
}

module.exports = CryptoRpcProvider;
