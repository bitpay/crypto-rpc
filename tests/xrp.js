const { CryptoRpc } = require('../');
const {assert, expect} = require('chai');
const mocha = require('mocha');
const {describe, it} = mocha;
const config = {
  chain: 'XRP',
  currency: 'XRP',
  host: 'rippled',
  protocol: 'ws',
  rpcPort: '6006',
  address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  currencyConfig: {
    sendTo: 'rDFrG4CgPFMnQFJBmZH7oqTjLuiB3HS4eu',
    privateKey:
      '117ACF0C71DE079057F4D125948D2F1F12CB3F47C234E43438E1E44C93A9C583',
    rawTx:
      '12000322800000002400000017201B0086955368400000000000000C732102F89EAEC7667B30F33D0687BBA86C3FE2A08CCA40A9186C5BDE2DAA6FA97A37D874473045022100BDE09A1F6670403F341C21A77CF35BA47E45CDE974096E1AA5FC39811D8269E702203D60291B9A27F1DCABA9CF5DED307B4F23223E0B6F156991DB601DFB9C41CE1C770A726970706C652E636F6D81145E7B112523F68D2F5E879DB4EAC51C6698A69304'
  }
};

describe('XRP Tests', function() {
  const currency = 'XRP';
  const rpcs = new CryptoRpc(config);
  const xrpRPC = rpcs.get(currency);
  let blockHash = '';
  let txid = '';

  it('should be able to get a block hash', async () => {
    blockHash = await rpcs.getBestBlockHash({ currency });
    expect(blockHash).to.have.lengthOf('64');
  });

  it('should estimate fee', async () => {
    let fee = await xrpRPC.estimateFee();
    assert.isTrue(fee === '0.000012');
  });

  it('should get block', async () => {
    const reqBlock = await rpcs.getBlock({ currency, hash: blockHash });
    expect(reqBlock).to.have.property('ledger');
    let ledger = reqBlock.ledger;
    expect(ledger).to.have.property('accepted');
    expect(ledger.accepted).to.equal(true);
    expect(ledger).to.have.property('ledger_hash');
    expect(ledger).to.have.property('ledger_index');
    expect(ledger).to.have.property('parent_hash');
    expect(ledger).to.have.property('transactions');
    expect(ledger.transactions).to.deep.equal([]);
    expect(reqBlock).to.have.property('ledger_hash');
    expect(reqBlock).to.have.property('ledger_index');
    expect(reqBlock.ledger_hash).to.equal(ledger.ledger_hash);
    expect(reqBlock.ledger_index.toString()).to.equal(ledger.ledger_index);
    expect(reqBlock).to.have.property('validated');
    expect(reqBlock.validated).to.equal(true);
    assert(reqBlock);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency, address: config.address });
    expect(balance).to.eq(100000000000);
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb' });
    expect(txid).to.have.lengthOf(64);
    assert(txid);
  });


  it('should be able to send many transactions', async () => {
    let payToArray = [];
    const transaction1 = {
      address: 'r38UsJxHSJKajC8qcNmofxJvCESnzmx7Ke',
      amount: 10000
    };
    const transaction2 = {
      address: 'rMGhv5SNsk81QN1fGu6RybDkUi2of36dua',
      amount: 20000
    };
    const transaction3 = {
      address: 'r4ip6t3NUe4UWguLUJCbyojxG6PdPZg9EJ',
      amount: 30000
    };
    const transaction4 = {
      address: 'rwtFtAMNXPoq4xgxn3FzKKGgVZErdcuLST',
      amount: 40000
    };
    payToArray.push(transaction1);
    payToArray.push(transaction2);
    payToArray.push(transaction3);
    payToArray.push(transaction4);
    const eventEmitter = rpcs.rpcs.XRP.emitter;
    let eventCounter = 0;
    let emitResults = [];
    const emitPromise = new Promise(resolve => {
      eventEmitter.on('success', (emitData) => {
        eventCounter++;
        emitResults.push(emitData);
        if (eventCounter === 3) {
          resolve();
        }
      });
    });
    const outputArray = await rpcs.unlockAndSendToAddressMany({ payToArray, secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb' });
    await emitPromise;
    expect(outputArray).to.have.lengthOf(4);
    expect(outputArray[0]).to.have.property('txid');
    expect(outputArray[1]).to.have.property('txid');
    expect(outputArray[2]).to.have.property('txid');
    expect(outputArray[3]).to.have.property('txid');
    for (let transaction of outputArray) {
      assert(transaction.txid);
      expect(transaction.txid).to.have.lengthOf(64);
    }
    for (let emitData of emitResults) {
      assert(emitData.address);
      assert(emitData.amount);
      assert(emitData.txid);
      expect(emitData.error === null);
      expect(emitData.vout === 0 || emitData.vout === 1);
      let transactionObj = {address: emitData.address, amount: emitData.amount};
      expect(payToArray.includes(transactionObj));
    }
  });

  it('should reject when one of many transactions fails', async () => {
    const address = config.currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
      { address: 'funkyColdMedina', amount: 1 }
    ];
    const eventEmitter = rpcs.rpcs.XRP.emitter;
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
      secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb'
    });
    await emitPromise;
    expect(emitResults.length).to.equal(1);
    assert(emitResults[0].error);
    assert(!outputArray[1].txid);
    expect(outputArray[1].error).to.equal(emitResults[0].error);
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    expect(tx).to.have.property('Account');
    expect(tx).to.have.property('Amount');
    expect(tx).to.have.property('Destination');
    expect(tx).to.have.property('Fee');
    expect(tx).to.have.property('Flags');
    expect(tx).to.have.property('LastLedgerSequence');
    expect(tx).to.have.property('Sequence');
    expect(tx).to.have.property('hash');
    expect(tx.hash).to.equal(txid);
    assert(tx);
    assert(typeof tx === 'object');
  });

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = config.currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    expect(decoded).to.have.property('Fee');
    expect(decoded).to.have.property('Sequence');
    expect(decoded).to.have.property('Account');
    expect(decoded).to.have.property('TxnSignature');
    expect(decoded).to.have.property('SigningPubKey');
    expect(decoded).to.have.property('Sequence');
    expect(decoded).to.have.property('TransactionType');
    expect(decoded.TransactionType).to.deep.equal('AccountSet');
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
    expect(confirmations).to.eq(0);
    let acceptance = await xrpRPC.asyncRequest('ledger_accept');
    assert(acceptance);
    expect(acceptance).to.have.property('ledger_current_index');
    confirmations = await rpcs.getConfirmations({ currency, txid });
    expect(confirmations).to.eq(1);
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
