const { CryptoRpc } = require('../');
const assert = require('assert');
const mocha = require('mocha');
const {describe, it} = mocha;

describe('ETH Tests', () => {
  const rpc = new CryptoRpc({
    host: 'localhost',
    protocol: 'http',
    rpcPort: '8545'
  }, { account: '0xd8fd14fb0e0848cb931c1e54a73486c4b968be3d'});

  it('should be able to get a balance', async () => {
    const balance = await rpc.getBalance('ETH');
    console.log(balance);
    assert(balance);
  });

  it('should be able to send a transaction', (done) => {
    rpc.unlockAndSendToAddress('ETH', '0x0000000000000000000000000000000000000000', '1', (err, tx) => {
      console.log(tx);
      assert(tx);
      done();
    }, '')
  });
});


describe('BTC Tests', () => {
  let txid = '';
  const rpc = new CryptoRpc({
    host: 'localhost',
    protocol: 'http',
    rpcPort: '20005',
    user: 'bitpaytest',
    pass: 'local321'
  }, {});

  it('should be able to get a balance', async () => {
    const balance = await rpc.getBalance('BTC');
    console.log(balance);
    assert(balance);
  });

  it('should be able to send a transaction', (done) => {
    rpc.unlockAndSendToAddress('BTC', '2NGFWyW3LBPr6StDuDSNFzQF3Jouuup1rua', '1', (err, tx) => {
      console.log(tx);
      txid = tx.result;
      assert(tx);
      done();
    }, '')
  });

  it('should be be able to get a transaction', async () => {
    const tx = await rpc.getTransaction('BTC', txid);
    console.log(tx);
    assert(tx.result);
  })
});
