const { CryptoRpc } = require('../');
const assert = require('assert');
const mocha = require('mocha');
const { before, describe, it } = mocha;
const config = {
  chain: 'BTC',
  host: 'bitcoin',
  protocol: 'http',
  rpcPort: '8333',
  rpcUser: 'cryptorpc',
  rpcPass: 'local321',
  tokens: {},
  currencyConfig: {
    sendTo: '2NGFWyW3LBPr6StDuDSNFzQF3Jouuup1rua',
    unlockPassword: 'password',
    rawTx:
      '0100000001641ba2d21efa8db1a08c0072663adf4c4bc3be9ee5aabb530b2d4080b8a41cca000000006a4730440220062105df71eb10b5ead104826e388303a59d5d3d134af73cdf0d5e685650f95c0220188c8a966a2d586430d84aa7624152a556550c3243baad5415c92767dcad257f0121037aaa54736c5ffa13132e8ca821be16ce4034ae79472053dde5aa4347034bc0a2ffffffff0240787d010000000017a914c8241f574dfade4d446ec90cc0e534cb120b45e387eada4f1c000000001976a9141576306b9cc227279b2a6c95c2b017bb22b0421f88ac00000000'
  }
};

describe('BTC Tests', function() {
  this.timeout(10000);
  let txid = '';
  let blockHash = '';
  const currency = 'BTC';
  const { currencyConfig } = config;
  const rpcs = new CryptoRpc(config, currencyConfig);
  const bitcoin = rpcs.get('BTC');


  before(async () => {
    try {
      await bitcoin.asyncCall('encryptWallet', ['password']);
    } catch (e) {
      console.warn('wallet already encrypted');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    await bitcoin.asyncCall('generate', [101]);
  });


  it('should be able to get a block hash', async () => {
    const block = await rpcs.getBestBlockHash({ currency });
    blockHash = block;
    assert(block);
  });

  it('should get block', async () => {
    const reqBlock = await rpcs.getBlock({ currency, hash: blockHash });
    assert(reqBlock);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', passphrase: currencyConfig.unlockPassword });
    assert(txid);
  });

  it('should be able to send many transactions', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
    ];
    const txids = await rpcs.unlockAndSendToAddressMany({ currency, payToArray, passphrase: currencyConfig.unlockPassword });
    assert(txids[0]);
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 },
    ];
    try {
      await rpcs.unlockAndSendToAddressMany({ currency, payToArray, passphrase: currencyConfig.unlockPassword });
    } catch (error) {
      assert(error.message = 'At least one of many requests Failed');
      assert(error.data.failure[1]);
    }
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    assert(tx);
    assert(typeof tx === 'object');
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    assert(decoded);
  });

  it('should get the tip', async () => {
    const tip = await rpcs.getTip({ currency });
    assert(tip != undefined);
  });

  it('should get confirmations', async () => {
    const confirmations = await rpcs.getConfirmations({ currency, txid });
    assert(confirmations != undefined);
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: config.currencyConfig.sendTo });
    assert(isValid === true);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: 'NOTANADDRESS' });
    assert(isValid === false);
  });

});
