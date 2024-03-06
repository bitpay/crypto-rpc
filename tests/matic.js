const { CryptoRpc } = require('../');
const {assert, expect} = require('chai');
const mocha = require('mocha');
const { before, describe, it } = mocha;
const ethers = require('ethers');
const util = require('web3-utils');
const config = {
  chain: 'MATIC',
  host: 'ganache',
  protocol: 'http',
  port: '8545',
  rpcPort: '8545',
  account: '0x86c32132831Eb7B05789fa4414Ca425ff31E1950',
  currencyConfig: {
    sendTo: '0x7382714Fc11693992Fb7f8ED43e2F79c94C8713c',
    unlockPassword: '',
    privateKey:
      '28abbe2a8a7d40ff64b422b0e6ec733062bdca52227a3137bc949803002b8c3a',
    rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
  }
};

describe('MATIC Tests', function() {
  const currency = 'MATIC';
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
    // const txCount = await rpcs.getTransactionCount({
    //   currency,
    //   address: config.account
    // });

    // construct the transaction data
    const txData = {
      nonce: 15,
      gasLimit: 25000,
      gasPrice: 2.1*10e9,
      to: config.currencyConfig.sendTo,
      value: Number(util.toWei('123', 'wei'))
    };
    const privateKey = Buffer.from(config.currencyConfig.privateKey, 'hex');
    const signer = new ethers.Wallet(privateKey);
    const signedTx = await signer.signTransaction(txData);
    const sentTx = await rpcs.sendRawTransaction({
      currency,
      rawTx: signedTx
    });
    expect(sentTx.length).to.equal(66);
  });

  it('should catch failed send raw transaction', async () => {
    try {
      // construct the transaction data
      const txData = {
        nonce: 16,
        gasLimit: 25000,
        gasPrice: 2.1*10e9,
        to: config.currencyConfig.sendTo,
        value: Number(util.toWei('123', 'wei'))
      };
      const privateKey = Buffer.from(config.currencyConfig.privateKey, 'hex');
      const signer = new ethers.Wallet(privateKey);
      const signedTx = await signer.signTransaction(txData);
      await rpcs.sendRawTransaction({
        currency,
        rawTx: signedTx
      });
    } catch(err) {
      expect(err.message).to.include('Transaction nonce is too low');
    }
  });

  // it('should succeed send raw transaction already broadcast', async () => {
  //
  //   const txCount = await rpcs.getTransactionCount({
  //     currency,
  //     address: config.account
  //   });
  //
  //   try {
  //     // construct the transaction data
  //     const txData = {
  //       nonce: util.toHex(txCount),
  //       gasLimit: util.toHex(25000),
  //       gasPrice: util.toHex(2.1*10e9),
  //       to: config.currencyConfig.sendTo,
  //       from: config.account,
  //       value: util.toHex(util.toWei('123', 'wei'))
  //     };
  //
  //     const rawTx = new EthereumTx(txData);
  //     const privateKey = Buffer.from(config.currencyConfig.privateKey, 'hex');
  //     rawTx.sign(privateKey);
  //     const serializedTx = rawTx.serialize();
  //     const txSend1 = await rpcs.sendRawTransaction({
  //       currency,
  //       rawTx: '0x' + serializedTx.toString('hex')
  //     });
  //     const txSend2 = await rpcs.sendRawTransaction({
  //       currency,
  //       rawTx: '0x' + serializedTx.toString('hex')
  //     });
  //     expect(txSend1).to.equal(txSend2);
  //   } catch(err) {
  //     console.error(err);
  //     expect(err.toString()).to.not.exist();
  //   }
  // });


  it('should estimate gas price', async () => {
    const gasPrice = await ethRPC.estimateGasPrice();
    assert.isDefined(gasPrice);
    expect(gasPrice).to.be.eq(20000000000);
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

  it('should be able to send a transaction and specify a custom nonce and gasPrice', async () => {
    txid = await rpcs.unlockAndSendToAddress({
      currency,
      address: config.currencyConfig.sendTo,
      amount: '10000',
      passphrase: currencyConfig.unlockPassword,
      gasPrice: 30000000000,
      nonce: 1
    });
    let decodedParams = await rpcs.getTransaction({ txid });
    expect(decodedParams.nonce).to.equal(1);
    expect(decodedParams.gasPrice).to.equal('30000000000');
    assert.isTrue(util.isHex(txid));
  });

  it('should be able to send many transactions', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [{ address, amount }, {address, amount}];
    const eventEmitter = rpcs.rpcs.MATIC.emitter;
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
    const eventEmitter = rpcs.rpcs.MATIC.emitter;
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

  it('should be able to get server info', async () => {
    const info = await rpcs.getServerInfo({ currency });
    expect(typeof info).to.equal('string');
  });
});
