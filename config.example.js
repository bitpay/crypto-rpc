module.exports = {
  BTCNode: {
    chain: 'BTC',
    host: 'localhost',
    rpcPort: '20009',
    protocol: 'http',
    rpcUser: 'bitpaytest',
    rpcPass: 'local321',
  },
  BCHNode: {
    chain: 'BCH',
    host: 'localhost',
    rpcPort: '20003',
    protocol: 'http',
    user: 'bitpaytest',
    pass: 'local321',
  },
  ETHNode: {
    chain: 'ETH',
    host: 'localhost',
    rpcPort: '8545',
    protocol: 'http',
    tokens : {
      GUSD: {
        tokenContractAddress: '0x00C3f2662F4F56623712BaC28179E7aDf952c0F0',
        type: 'ERC20'
      },
      USDC: {
        tokenContractAddress: '0xc2258ea076cF2467960EE9B62264b9E17d59eFc9',
        type: 'ERC20'
      },
      PAX: {
        tokenContractAddress: '0x531f6D8aFA88CC6966FD817340b2A5D7FA3750AD',
        type: 'ERC20'
      }
    }
  }
};
