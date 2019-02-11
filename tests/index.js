const { CryptoRpc } = require('../');
const assert = require('assert');
const mocha = require('mocha');
const {describe, it} = mocha;


const currencyConfig = {
  ETH: {
    host: 'localhost',
    protocol: 'http',
    rpcPort: '8545',
    currencyConfig: {
      sendTo: '0x0000000000000000000000000000000000000000',
      account: '0xd8fd14fb0e0848cb931c1e54a73486c4b968be3d'
    }
  },
  BTC: {
    host: 'localhost',
    protocol: 'http',
    rpcPort: '20005',
    user: 'bitpaytest',
    pass: 'local321',
    currencyConfig: {
      sendTo: '2NGFWyW3LBPr6StDuDSNFzQF3Jouuup1rua'
    }
  }
}

function TestForCurrency(currency, currencyConfigs) {
  let txid = '';
  const config = currencyConfigs[currency];
  const rpc = new CryptoRpc(config, config.currencyConfig);

  it('should be able to get a balance', async () => {
    const balance = await rpc.getBalance(currency);
    console.log(balance);
    assert(balance);
  });

  it('should be able to send a transaction', (done) => {
    rpc.unlockAndSendToAddress(currency, config.currencyConfig.sendTo, '1', (err, tx) => {
      console.log(tx);
      assert(tx);
      txid = tx;
      done();
    }, '')
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpc.getTransaction(currency, txid);
    console.log(tx);
    assert(tx);
  });

  it('should be able to decode a raw transaction', async () => {
    const tx = await rpc.getRawTransaction(currency, txid);
    assert(tx);
    console.log(tx);
    const decoded = await rpc.decodeRawTransaction(currency, tx);
    console.log(decoded)
    assert(decoded);
  });

  it('should be able to get a block hash', async () => {
    const block = await rpc.getBestBlockHash(currency);
    console.log(block);
    assert(block);
  });
  
  it('should estimate fee', async () => {
    const fee = await rpc.estimateFee(currency, nBlocks = 4);
    console.log(fee); 
    assert(fee);
  });
}


describe('ETH Tests', () => {
  TestForCurrency('ETH', currencyConfig);
});


describe('BTC Tests', () => {
  TestForCurrency('BTC', currencyConfig);
});
