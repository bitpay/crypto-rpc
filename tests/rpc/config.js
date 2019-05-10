const ERC20 = require('../../blockchain/build/contracts/CryptoErc20.json');
module.exports = {
  BTC: {
    chain: 'BTC',
    host: 'bitcoin',
    protocol: 'http',
    rpcPort: '8333',
    rpcUser: 'cryptorpc',
    rpcPass: 'local321',
    tokens: {},
  },
  BCH: {
    chain: 'BCH',
    host: 'bitcoin-cash',
    protocol: 'http',
    rpcPort: '9333',
    rpcUser: 'cryptorpc',
    rpcPass: 'local321',
    tokens: {},
  },
  ETH: {
    chain: 'ETH',
    host: 'ganache',
    protocol: 'http',
    rpcPort: '8545',
    account: '0xd8fD14fB0E0848Cb931c1E54a73486c4B968BE3D',
    tokens: {
      ERC20: {
        tokenContractAddress: ERC20.networks['5555'].address,
        type: 'ERC20'
      }
    }
  }
};
