module.exports = {
  BTCNode: {
    host: 'localhost',
    rpcPort: '20009',
    protocol: 'http',
    user: 'bitpaytest',
    pass: 'local321',
    currencies: {
      BTC: {}
    }
  },
  BCHNode: {},
  ETHNode: {
    host: 'localhost',
    rpcPort: '8545',
    protocol: 'http',
    tokens: {
      GUSD: {
        type: 'ERC20',
        tokenContractAddress: '0x0A07Be89cD1768AD1aB27566078c63D559E4b464'
      },
      USDC: {
        type: 'ERC20',
        tokenContractAddress: '0xc92e381c387edbfd2e2112f3054896dd20ac3d31'
      }
    },
  }
};
