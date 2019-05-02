const { CryptoRpc } = require('../');
const sinon = require('sinon');
const assert = require('assert');
const mocha = require('mocha');
const { expect } = require('chai');
const { before, describe, it } = mocha;
const config = {
  chain: 'BCH',
  host: 'bitcoin-cash',
  protocol: 'http',
  rpcPort: '9333',
  rpcUser: 'cryptorpc',
  rpcPass: 'local321',
  tokens: {},
  currencyConfig: {
    sendTo: 'bchreg:qq9kqhzxeul20r7nsl2lrwh8d5kw97np9u960ue086',
    unlockPassword: 'password',
    rawTx:
    '0200000001445703d7470ec3e435db0f33da332fc654ae0c8d264572e487bd427125659d7500000000484730440220704a6a336eb930a95b2a6a941b3c43ccb2207db803a2332512ac255c1740b9d7022057c7bc00a188de7f4868774d1e9ff626f8bd6eca8187763b9cb184354ddc5dde41feffffff0200021024010000001976a914db1f764e6a60e4a8cb919c55e95ac41517f5cddc88ac00e1f505000000001976a9140b605c46cf3ea78fd387d5f1bae76d2ce2fa612f88ac66000000'
  }
};

describe('BCH Tests', function() {
  this.timeout(10000);
  let txid = '';
  let blockHash = '';
  const currency = 'BCH';
  const { currencyConfig } = config;
  const rpcs = new CryptoRpc(config, currencyConfig);
  const bitcoin = rpcs.get(currency);

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
    blockHash = await rpcs.getBestBlockHash({ currency });
    expect(blockHash).to.have.lengthOf('64');
  });


  it('should be able to estimateFee', async () => {
    sinon.stub(bitcoin.rpc,'estimateFee').callsFake((nBlocks, cb) => {
      cb(null, {result: 0.00001234});
    });
    const fee = await bitcoin.estimateFee({nBlocks: 2});
    expect(fee).to.be.eq(1.234);
  });

  it('should get block', async () => {
    const reqBlock = await rpcs.getBlock({ currency, hash: blockHash });
    expect(reqBlock).to.have.property('hash');
    expect(reqBlock).to.have.property('confirmations');
    expect(reqBlock).to.have.property('size');
    expect(reqBlock).to.have.property('height');
    expect(reqBlock).to.have.property('version');
    expect(reqBlock).to.have.property('versionHex');
    expect(reqBlock).to.have.property('merkleroot');
    expect(reqBlock).to.have.property('tx');
    expect(reqBlock).to.have.property('time');
    expect(reqBlock).to.have.property('mediantime');
    expect(reqBlock).to.have.property('nonce');
    expect(reqBlock).to.have.property('bits');
    expect(reqBlock).to.have.property('difficulty');
    expect(reqBlock).to.have.property('chainwork');
    expect(reqBlock).to.have.property('previousblockhash');
    assert(reqBlock);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    expect(balance).to.eq(5000000000);
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', passphrase: currencyConfig.unlockPassword });
    expect(txid).to.have.lengthOf(64);
    assert(txid);
    await bitcoin.asyncCall('generate', [1]);
  });

  it('should be able to send many transactions', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
    ];
    const txids = await rpcs.unlockAndSendToAddressMany({ currency, payToArray, passphrase: currencyConfig.unlockPassword, time: 1000 });
    expect(txids).to.have.lengthOf(1);
    assert(txids[0]);
    expect(txids[0]).to.have.lengthOf(64);
    await bitcoin.asyncCall('generate', [1]);

  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 },
    ];
    try {
      await rpcs.unlockAndSendToAddressMany({ currency, payToArray, passphrase: currencyConfig.unlockPassword, time: 1000 });
    } catch (error) {
      assert(error.message = 'At least one of many requests Failed');
      assert(error.data.failure[1]);
    }
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    expect(tx).to.have.property('txid');
    expect(tx).to.have.property('hash');
    expect(tx).to.have.property('version');
    expect(tx).to.have.property('size');
    expect(tx).to.have.property('locktime');
    expect(tx).to.have.property('vin');
    expect(tx).to.have.property('vout');
    expect(tx).to.have.property('hex');
    assert(tx);
    assert(typeof tx === 'object');
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.have.property('txid');
    expect(decoded).to.have.property('hash');
    expect(decoded).to.have.property('version');
    expect(decoded).to.have.property('size');
    expect(decoded).to.have.property('locktime');
    expect(decoded).to.have.property('vin');
    expect(decoded).to.have.property('vout');
    assert(decoded);
  });

  it('should get the tip', async () => {
    const tip = await rpcs.getTip({ currency });
    assert(tip != undefined);
    expect(tip).to.have.property('hash');
    expect(tip).to.have.property('height');
  });

  it('should get confirmations', async () => {
    let confirmations = await rpcs.getConfirmations({ currency, txid });
    assert(confirmations != undefined);
    expect(confirmations).to.eq(2);
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: config.currencyConfig.sendTo });
    assert(isValid === true);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: 'NOTANADDRESS' });
    assert(isValid === false);
  });

  it('should be able to send a bached transaction', async() => {
    let address1 = 'bchreg:qq2lqjaeut5ppjkx9339htfed8enx7hmugk37ytwqy';
    let amount1 = 10000;
    let address2 = 'bchreg:qq6n0n37mut4353m9k2zm5nh0pejk7vh7u77tan544';
    let amount2 = 20000;
    const obj = {};
    obj[address1] = amount1;
    obj[address2] = amount2;

    await bitcoin.walletUnlock({ passphrase: config.currencyConfig.unlockPassword, time: 10 });
    let txid = await bitcoin.sendMany({ obj: obj, options: null });
    await bitcoin.walletLock();
    expect(txid).to.have.lengthOf(64);
    assert(txid);
  });

  it('should be able to unlock wallet and send a bached transaction', async() => {
    let address1 = config.currencyConfig.sendTo;
    let amount1 = 10000;
    let address2 = 'bchreg:qq6n0n37mut4353m9k2zm5nh0pejk7vh7u77tan544';
    let amount2 = 20000;
    const obj = {};
    obj[address1] = amount1;
    obj[address2] = amount2;

    let txid = await bitcoin.unlockAndSendManyBatched({ obj: obj, passphrase: currencyConfig.unlockPassword, options: null });
    expect(txid).to.have.lengthOf(64);
    assert(txid);
  });

});
