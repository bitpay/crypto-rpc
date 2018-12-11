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
    currencies : {
      GUSD: {
        //tokenContractAddress: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
        tokenContractAddress: '0xd0683a2f4e9ecc9ac6bb41090b4269f7cacdd5d4'
      },
      USDC: {
        //tokenContractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
        tokenContractAddress: '0xc92e381c387edbfd2e2112f3054896dd20ac3d31'
      }
    }
  }
}
