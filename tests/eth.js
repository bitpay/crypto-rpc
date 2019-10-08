const { CryptoRpc } = require('../');
const {assert, expect} = require('chai');
const mocha = require('mocha');
const { before, describe, it } = mocha;
const EthereumTx = require('ethereumjs-tx');
const util = require('web3-utils');
const config = {
  chain: 'ETH',
  host: 'ganache',
  protocol: 'http',
  port: '8545',
  rpcPort: '8545',
  account: '0xd8fD14fB0E0848Cb931c1E54a73486c4B968BE3D',
  currencyConfig: {
    sendTo: '0xA15035277A973d584b1d6150e93C21152D6Af440',
    unlockPassword: '',
    privateKey:
      '117ACF0C71DE079057F4D125948D2F1F12CB3F47C234E43438E1E44C93A9C583',
    rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
  }
};

describe('ETH Tests', function() {
  const currency = 'ETH';
  const currencyConfig = config.currencyConfig;
  const rpcs = new CryptoRpc(config, currencyConfig);
  const ethRPC = rpcs.get(currency);
  let txid = '';
  let blockHash = '';

  this.timeout(10000);

  before(done => {
    setTimeout(done, 5000);
  });

  it('should estimate fee', async () => {
    const fee = await rpcs.estimateFee({ currency, nBlocks: 4 });
    assert.isTrue(fee === 20000000000);
  });


  it('should send raw transaction', async () => {
    // Reset nonce to 0
    const txCount = await rpcs.getTransactionCount({
      currency,
      address: config.account
    });

    // construct the transaction data
    const txData = {
      nonce: util.toHex(txCount),
      gasLimit: util.toHex(25000),
      gasPrice: util.toHex(2.1*10e9),
      to: config.currencyConfig.sendTo,
      from: config.account,
      value: util.toHex(util.toWei('123', 'wei'))
    };

    const rawTx = new EthereumTx(txData);
    const privateKey = Buffer.from(config.currencyConfig.privateKey, 'hex');
    rawTx.sign(privateKey);
    const serializedTx = rawTx.serialize();
    const sentTx = await rpcs.sendRawTransaction({
      currency,
      rawTx: '0x' + serializedTx.toString('hex')
    });
    assert.isTrue(sentTx.from === txData.from.toLowerCase());
    assert.isTrue(sentTx.to === txData.to.toLowerCase());
    expect(sentTx).to.have.property('transactionHash');
    expect(sentTx).to.have.property('transactionIndex');
    expect(sentTx).to.have.property('blockHash');
    expect(sentTx).to.have.property('blockNumber');
    expect(sentTx).to.have.property('gasUsed');
    expect(sentTx).to.have.property('from');
    expect(sentTx).to.have.property('to');
    expect(sentTx).to.have.property('cumulativeGasUsed');
    expect(sentTx).to.have.property('contractAddress');
    expect(sentTx).to.have.property('logs');
    expect(sentTx).to.have.property('status');
    expect(sentTx).to.have.property('logsBloom');
    expect(sentTx).to.have.property('v');
    expect(sentTx).to.have.property('r');
    expect(sentTx).to.have.property('s');
  });


  it('should estimate gas price', async () => {
    const gasPrice = await ethRPC.estimateGasPrice();
    assert.isDefined(gasPrice);
    expect(gasPrice).to.be.eq(20300000000);
  });

  it('should be able to get a block hash', async () => {
    const block = await rpcs.getBestBlockHash({ currency });
    blockHash = block;
    assert.isTrue(util.isHex(block));
  });

  it('should get block', async () => {
    const reqBlock = await rpcs.getBlock({ currency, hash: blockHash });
    assert(reqBlock.hash === blockHash);
    expect(reqBlock).to.have.property('number');
    expect(reqBlock).to.have.property('hash');
    expect(reqBlock).to.have.property('parentHash');
    expect(reqBlock).to.have.property('mixHash');
    expect(reqBlock).to.have.property('nonce');
    expect(reqBlock).to.have.property('sha3Uncles');
    expect(reqBlock).to.have.property('logsBloom');
    expect(reqBlock).to.have.property('transactionsRoot');
    expect(reqBlock).to.have.property('stateRoot');
    expect(reqBlock).to.have.property('receiptsRoot');
    expect(reqBlock).to.have.property('miner');
    expect(reqBlock).to.have.property('difficulty');
    expect(reqBlock).to.have.property('totalDifficulty');
    expect(reqBlock).to.have.property('extraData');
    expect(reqBlock).to.have.property('size');
    expect(reqBlock).to.have.property('gasLimit');
    expect(reqBlock).to.have.property('gasUsed');
    expect(reqBlock).to.have.property('timestamp');
    expect(reqBlock).to.have.property('transactions');
    expect(reqBlock).to.have.property('uncles');
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    assert(util.isAddress(balance[0].account));
    assert.hasAllKeys(balance[0], ['account', 'balance']);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({
      currency,
      address: config.currencyConfig.sendTo,
      amount: '10000',
      passphrase: currencyConfig.unlockPassword
    });
    assert.isTrue(util.isHex(txid));
  });

  it('should be able to send many transactions', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [{ address, amount }, {address, amount}];
    const eventEmitter = rpcs.rpcs.ETH.emitter;
    let eventCounter = 0;
    let emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('success', (emitData) => {
        eventCounter++;
        emitResults.push(emitData);
        if (eventCounter === 2) {
          resolve(emitResults);
        }
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({
      currency,
      payToArray,
      passphrase: currencyConfig.unlockPassword
    });
    await emitPromise;
    assert(emitResults[0].txid);
    expect(emitResults[0].error === null);
    expect(emitResults[0].address === address);
    expect(emitResults[0].amount === amount);
    assert(emitResults[1].txid);
    expect(emitResults[1].error === null);
    expect(emitResults[1].address === address);
    expect(emitResults[1].amount === amount);
    assert.isTrue(outputArray.length === 2);
    assert.isTrue(util.isHex(outputArray[0].txid));
    assert.isTrue(util.isHex(outputArray[1].txid));
    expect(outputArray[0].txid).to.have.lengthOf(66);
    expect(outputArray[1].txid).to.have.lengthOf(66);
    expect(outputArray[1].txid).to.not.equal(outputArray[0].txid);
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.ETH.emitter;
    let emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('failure', (emitData) => {
        emitResults.push(emitData);
        resolve();
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({
      currency,
      payToArray,
      passphrase: currencyConfig.unlockPassword
    });
    await emitPromise;
    assert(!outputArray[1].txid);
    expect(outputArray[1].error).to.equal(emitResults[0].error);
    expect(emitResults.length).to.equal(1);
    assert(emitResults[0].error);
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    assert.isDefined(tx);
    assert.isObject(tx);
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    assert.isDefined(decoded);
  });

  it('should get the tip', async () => {
    const tip = await rpcs.getTip({ currency });
    assert.hasAllKeys(tip, ['height', 'hash']);
  });

  it('should get confirmations', async () => {
    const confirmations = await rpcs.getConfirmations({ currency, txid });
    assert.isDefined(confirmations);
  });

  it('should not get confirmations with invalid txid', async () => {
    try {
      await rpcs.getConfirmations({ currency, txid: 'wrongtxid' });
    } catch (err) {
      assert.isDefined(err);
    }
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({
      currency,
      address: config.currencyConfig.sendTo
    });
    const utilVaildate = util.isAddress(config.currencyConfig.sendTo);
    assert.isTrue(isValid === utilVaildate);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({
      currency,
      address: 'NOTANADDRESS'
    });
    const utilVaildate = util.isAddress('NOTANADDRESS');
    assert.isTrue(isValid === utilVaildate);
  });
});
