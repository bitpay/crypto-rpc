const { CryptoRpc } = require('../');
const Web3 = require('@solana/web3.js');
const chai = require('chai');
const assert = require('assert');
const { expect } = chai;
const should = chai.should();
const mocha = require('mocha');
const { before, describe, it } = mocha;
const sinon = require('sinon');
const privateKey1 = require('../blockchain/solana/test/keypair/id.json');
const privateKey2 = require('../blockchain/solana/test/keypair/id2.json');
const privateKey3 = require('../blockchain/solana/test/keypair/id2.json');
const config = {
  chain: 'SOL',
  host: 'solana',
  protocol: 'http',
  port: '8899',
  rpcPort: '8899',
  account: '9RP9SZxn2E2qaGJ47SpVvLTd9v5gLPRAUL8CpQKQDAjp',
  privateKey: privateKey1,
  currencyConfig: {
    sendTo: '8WyoNvKsmfdG6zrbzNBVN8DETyLra3ond61saU9C52YR',
    privateKey: privateKey2,
    tokenAccount: 'F7FknkRckx4yvA3Gexnx1H3nwPxndMxVt58BwAzEQhcY',
    tokenAccountprivateKey: privateKey3,
    rawTx:
      'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQABA30ceZB+ENtmJJs1VsVVNdQOoqWSa6qXixe7usmdr33Hb6/gH5XxrVl86CZd+DpqA1jN8YSz91e8yXxOlyeS8tIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH7WMa6eSamXeAYr9Si588q7y9qaeAjv8ybNnel+W5BzAQICAAEMAgAAAAEAAAAAAAAAAA=='
  }
};
const devnetConfig = {
  chain: 'SOL',
  host: 'api.devnet.solana.com',
  protocol: 'https',
  currencyConfig: {
    address: 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN',
    tx: '28fUknaVpqsRd4D8tTGCw5Fd3qtdKFWsXXuG3jueL2QgMbZFYQhHKuhbDMUSHTH8tAxbeo4XHEhMnsFjubmjXPjU'
  }
};

describe('SOL Tests', function () {
  this.timeout(10000);
  const currency = 'SOL';
  const rpcs = new CryptoRpc(config);
  const MIN_FEE = 5000;
  let txid = '';
  let blockHash = '';
  let slot = '';

  before(done => {
    setTimeout(done, 5000);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should be able getBalance', async () => {
    const balance = await rpcs.getBalance({
      address: config.account
    });
    assert(Number.isInteger(balance));
    expect(balance).to.equal(100000000000);
  });

  it('should be able to send a transaction', async () => {
    const secretKey = Uint8Array.from(config.privateKey);
    const keypair = Web3.Keypair.fromSecretKey(secretKey);
    const balance1Before = await rpcs.getBalance({
      address: config.account
    });
    const balance2Before = await rpcs.getBalance({
      address: config.currencyConfig.sendTo
    });
    const amount = 10;
    try {
      // set txid to be used in subsequent tests
      txid = await rpcs.sendToAddress({
        currency,
        address: config.currencyConfig.sendTo,
        amount,
        fromAccount: config.account,
        fromAccountKeypair: keypair,
      });
    } catch (e) {
      should.not.exist(e);
    }
    assert(txid != null);
    expect(typeof txid).to.equal('string');
    txid.length.should.be.at.least(86);
    const balance1After = await rpcs.getBalance({
      address: config.account
    });
    const balance2After = await rpcs.getBalance({
      address: config.currencyConfig.sendTo
    });
    expect(balance2After).to.equal(balance2Before + amount);
    balance1After.should.be.at.most(balance1Before - amount - MIN_FEE);
  });

  it('should be able to get a chain tip', async () => {
    const { height, hash } = await rpcs.getTip({ currency });
    blockHash = hash;
    slot = height;
    assert(blockHash != null);
    assert(slot != null);
    assert(Number.isInteger(slot));
    blockHash.length.should.be.at.least(40);
  });

  it('should get block', async () => {
    const tip = await rpcs.getTip({ currency });
    const block1 = await rpcs.getBlock({ currency, height: tip.height });
    should.exist(block1);
    assert(block1.blockhash === blockHash);
    assert(block1.blockHeight === slot);
    expect(block1).to.have.property('blockHeight');
    expect(block1).to.have.property('blockTime');
    expect(block1).to.have.property('blockhash');
    expect(block1).to.have.property('previousBlockhash');
    expect(block1).to.have.property('transactions');
  });

  it('should be able getTransactionCount', async () => {
    const count = await rpcs.getTransactionCount({
      currency,
      address: config.account
    });
    expect(count).to.equal(2);
  });

  it('should be able to send a version 0 transaction', async () => {
    const secretKey = Uint8Array.from(config.privateKey);
    const keypair = Web3.Keypair.fromSecretKey(secretKey);
    const balance1Before = await rpcs.getBalance({
      address: config.account
    });
    const balance2Before = await rpcs.getBalance({
      address: config.currencyConfig.sendTo
    });
    const amount = 10;
    let _txid;
    try {
      _txid = await rpcs.sendToAddress({
        currency,
        address: config.currencyConfig.sendTo,
        amount,
        fromAccount: config.account,
        fromAccountKeypair: keypair,
        txType: 0
      });
    } catch (e) {
      should.not.exist(e);
    }
    assert(_txid != null);
    expect(typeof _txid).to.equal('string');
    _txid.length.should.be.at.least(86);
    const balance1After = await rpcs.getBalance({
      address: config.account
    });
    const balance2After = await rpcs.getBalance({
      address: config.currencyConfig.sendTo
    });
    expect(balance2After).to.equal(balance2Before + amount);
    balance1After.should.be.at.most(balance1Before - amount - MIN_FEE);
  });

  it('should validate address', async () => {
    assert(rpcs.validateAddress({ currency, address: config.account }));
  });

  it('should not validate bad address', async () => {
    assert(!rpcs.validateAddress({ currency, address: 'bad address' }));
  });

  it('should be able to get a raw transaciton', async () => {
    const rawTx = await rpcs.getRawTransaction({ currency, txid });
    should.exist(rawTx);
    assert(typeof rawTx === 'string');
    rawTx.length.should.be.at.least(1);
  });

  it('should be able to get a raw transaciton with invalid txid', async () => {
    const rawTx = await rpcs.getRawTransaction({ currency, txid: '' });
    expect(rawTx).to.equal(null);
  });

  it('should be able to decode a raw transaciton', async () => {
    const rawTx = await rpcs.getRawTransaction({ currency, txid });
    should.exist(rawTx);
    assert(typeof rawTx === 'string');
    const decodedTx = await rpcs.decodeRawTransaction({ currency, rawTx });
    should.exist(decodedTx);
    expect(decodedTx).to.have.property('message');
    expect(decodedTx).to.have.property('signatures');
    // make sure the keys match
  });

  it('should be able to send a raw transaciton (Uint8Array)', async () => {
    const { hash, height } = await rpcs.getTip({ currency });
    const secretKey = Uint8Array.from(config.privateKey);
    const keypair = Web3.Keypair.fromSecretKey(secretKey);
    const address = new Web3.PublicKey(config.currencyConfig.sendTo);
    const amount = 100000;
    const fromAccount = new Web3.PublicKey(config.account);
    const fromAccountKeypair = keypair;
    const balance1Before = await rpcs.getBalance({
      currency,
      address: config.account
    });
    const balance2Before = await rpcs.getBalance({
      currency,
      address: config.currencyConfig.sendTo
    });
    // create transaction
    const instructions = [
      Web3.SystemProgram.transfer({
        fromPubkey: fromAccount,
        toPubkey: address,
        lamports: BigInt(amount)
      })
    ];
    const message = new Web3.TransactionMessage({
      payerKey: fromAccount,
      recentBlockhash: hash,
      instructions
    }).compileToV0Message();
    let transaction = new Web3.VersionedTransaction(message);
    transaction.sign([fromAccountKeypair]);

    const rawTx = transaction.serialize();
    const _txid = await rpcs.sendRawTransaction({ currency, rawTx });
    assert(_txid != null);
    expect(typeof _txid).to.equal('string');
    _txid.length.should.be.at.least(86);
    await rpcs.rpcs['SOL'].connection.confirmTransaction({
      signature: _txid,
      blockhash: hash,
      lastValidBlockHeight: height
    });
    const balance1After = await rpcs.getBalance({
      currency,
      address: config.account
    });
    const balance2After = await rpcs.getBalance({
      currency,
      address: config.currencyConfig.sendTo
    });
    balance1After.should.be.at.most(balance1Before - amount - MIN_FEE);
    expect(balance2After).to.equal(balance2Before + amount);
  });

  it('should be able to send a raw transaciton (base64 string)', async () => {
    const solRPC = rpcs.rpcs['SOL'];
    const secretKey = Uint8Array.from(config.privateKey);
    const keypair = Web3.Keypair.fromSecretKey(secretKey);
    const amount = 1;
    const fromAccountKeypair = keypair;
    const { hash, height } = await rpcs.getTip({ currency });
    // get before balances
    const balance1Before = await rpcs.getBalance({
      currency,
      address: config.account
    });
    const balance2Before = await rpcs.getBalance({
      currency,
      address: config.currencyConfig.sendTo
    });

    // decode raw transaction string
    const decodedTx = await rpcs.decodeRawTransaction({
      currency,
      rawTx: config.currencyConfig.rawTx
    });
    decodedTx.message.recentBlockhash = hash;
    decodedTx.sign([fromAccountKeypair]);
    const rawTx2 = solRPC.uint8ArrayToBase64(decodedTx.serialize());
    // send transaction
    const _txid = await rpcs.sendRawTransaction({
      currency,
      rawTx: rawTx2,
    });
    await solRPC.connection.confirmTransaction({
      signature: _txid,
      blockhash: hash,
      lastValidBlockHeight: height
    });
    assert(_txid != null);
    expect(typeof _txid).to.equal('string');
    _txid.length.should.be.at.least(86);

    // check balances
    const balance1After = await rpcs.getBalance({
      currency,
      address: config.account
    });
    const balance2After = await rpcs.getBalance({
      currency,
      address: config.currencyConfig.sendTo
    });
    balance1After.should.be.at.most(balance1Before - amount - MIN_FEE);
    expect(balance2After).to.equal(balance2Before + amount);
  });

  it('should estimate fee by block', async () => {
    const fee = await rpcs.estimateFee({ currency, nBlocks: 4 });
    should.exist(fee);
    assert(Number.isInteger(fee));
    fee.should.be.at.least(MIN_FEE);
  });

  it('should estimate fee by transaction', async () => {
    try {
      const rawTx = await rpcs.getRawTransaction({ currency, txid });
      should.exist(rawTx);
      assert(typeof rawTx === 'string');
      const fee = await rpcs.estimateFee({ currency, rawTx });
      should.exist(fee);
      assert(Number.isInteger(fee));
      fee.should.be.at.least(MIN_FEE);
    } catch (e) {
      should.not.exist(e);
    }
  });

  it('should be able estimate priority fee', async () => {
    const devRPC = new CryptoRpc(devnetConfig);
    const percentiles = [10, 25, 50, 75, 100];
    const fees = [];

    for (let i = 0; i < percentiles.length; i++) {
      const fee = await devRPC.estimateMaxPriorityFee({ currency, percentile: percentiles[i] });
      if (Number(fee)) {
        fees.push(fee);
      }
    }

    fees.length.should.be.at.least(1);

    for (let i = 0; i < fees.length; i++) {
      should.exist(fees[i]);
      fees[i].should.be.at.least(1);
      if (i > 0) {
        fees[i].should.be.at.least(fees[i - 1]);
      } else if (fees.length > 2) {
        fees[i].should.be.at.most(fees[i + 1]);
      }
    }
  });

  it('should be able to connect to devnet', async () => {
    const devRPC = new CryptoRpc(devnetConfig);
    const address = new Web3.PublicKey(devnetConfig.currencyConfig.address);
    const balance = await devRPC.getBalance({ currency, address });
    assert(Number.isInteger(balance));
    balance.should.be.at.least(1000);
  });

  it('should be able to get server info', async () => {
    const devRPC = new CryptoRpc(devnetConfig);
    const info = await devRPC.getServerInfo({ currency });
    should.exist(info);
    expect(info).to.have.property('solana-core');
  });

  it('should get devnet transaction', async () => {
    const devRPC = new CryptoRpc(devnetConfig);
    const _tx = await devRPC.getTransaction({
      currency,
      txid: devnetConfig.currencyConfig.tx
    });
    should.exist(_tx);
    expect(_tx).to.have.property('transaction');
    expect(_tx.transaction).to.have.property('message');
    expect(_tx.transaction).to.have.property('signatures');
    expect(_tx.slot).to.equal(307878431);
  });

  it('should not get transaction with invalid txid', async () => {
    const tx = await rpcs.getTransaction({ currency, txid: '' });
    expect(tx).to.equal(null);
  });

  it('should get confirmations', async () => {
    const conf = await rpcs.getConfirmations({ currency, txid });
    should.exist(conf);
    assert(Number.isInteger(conf));
  });

  it('should not get confirmations with invalid txid', async () => {
    const conf = await rpcs.getConfirmations({ currency, txid: '' });
    expect(conf).to.equal(null);
  });
});