// eslint-disable-next-line no-unused-vars
const xrpl = require('xrpl'); // Here for typing
const { CryptoRpc } = require('../');
const {assert, expect} = require('chai');
const mocha = require('mocha');
const {describe, it, before} = mocha;
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
  },
  connectionIdleMs: 250
};

describe('XRP Tests', function() {
  let currency = 'XRP';
  let blockHash = '';
  let block;
  let txid = '';

  let rpcs;
  let xrpRPC;

  before(() => {
    rpcs = new CryptoRpc(config);
    xrpRPC = rpcs.get(currency);
  });

  it('should be able to get best block hash', async () => {
    try {
      blockHash = await rpcs.getBestBlockHash({ currency });
    } catch (err) {
      expect(err).to.not.exist();
    }

    expect(blockHash).to.have.lengthOf('64');
  });

  it('should estimate fee', async () => {
    let fee;
    try {
      fee = await xrpRPC.estimateFee();
    } catch (err) {
      expect(err).to.not.exist();
    }
    assert.isTrue(fee === '10');
  });

  const blockCases = [
    { description: 'by hash', params: { hash: blockHash  } },
    { description: 'by index', params: { index: 'defined below' } },
    { description: 'by latest', params: { index: 'latest' } },
  ];
  Object.defineProperty(blockCases[1].params, 'index', { get: () => block.ledger_index });

  for (const bcase of blockCases) {
    it(`should get block ${bcase.description}`, async () => {
      try {
        /** @type {xrpl.LedgerResponse['result'] | null}} */
        block = await rpcs.getBlock({ currency, ...bcase.params });
      } catch (err) {
        expect(err).to.not.exist();
      }

      expect(block).to.have.property('ledger');
      /** @type {xrpl.LedgerBinary} */
      let ledger = block.ledger;
      // from xrpl documentation: https://xrpl.org/ledger.html (9/26/2023)
      // The following fields are deprecated and may be removed without further notice: accepted, totalCoins (use total_coins instead).
      // as a result the following is commented out
      // expect(ledger).to.have.property('accepted');
      // expect(ledger.accepted).to.equal(true);
      expect(ledger).to.have.property('ledger_hash');
      expect(ledger).to.have.property('ledger_index');
      expect(ledger).to.have.property('parent_hash');
      expect(ledger).to.have.property('transactions');
      expect(ledger).to.have.property('transactions').that.is.an('array');
      expect(block).to.have.property('ledger_hash');
      expect(block).to.have.property('ledger_index');
      expect(block.ledger_hash).to.equal(ledger.ledger_hash);
      expect(typeof block.ledger_index).to.equal('number');
      expect(block.ledger_index).to.equal(ledger.ledger_index);
      expect(block).to.have.property('validated');
      expect(block.validated).to.equal(true);
      assert(block);
    });
  }

  it('should return nothing for unknown block', async () => {
    let unknownBlock;
    try {
      unknownBlock = await rpcs.getBlock({ currency, hash: '1723099E269C77C4BDE86C83FA6415D71CF20AA5CB4A94E5C388ED97123FB55B' });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(unknownBlock).to.be.null;
  });

  it('should be able to get a balance', async () => {
    let balance;
    try {
      balance = await rpcs.getBalance({ currency, address: config.address });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(balance).to.be.a('number');
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    await xrpRPC.asyncRequest('ledger_accept');
    let beforeToBalance;
    try {
      beforeToBalance = await rpcs.getBalance({ currency, address: config.currencyConfig.sendTo });
    } catch (err) {
      beforeToBalance = 0;
    }
    try {
      txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '10000', secret: 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb' });
    } catch (err) {
      expect(err).to.not.exist();
    }

    expect(txid).to.have.lengthOf(64);
    assert(txid);
    await xrpRPC.asyncRequest('ledger_accept');
    let afterToBalance = await rpcs.getBalance({ currency, address: config.currencyConfig.sendTo });
    expect(afterToBalance - beforeToBalance).to.eq(10000);
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
    /** @type {xrpl.TxResponse['result'] & {confirmations: number; blockHash: string}} */
    let tx;
    try {
      tx = await rpcs.getTransaction({ currency, txid });
    } catch (err) {
      expect(err).to.not.exist();
    }
    // New expectations
    expect(tx).to.have.property('tx_json');
    expect(tx.tx_json).to.have.property('Account');
    expect(tx.tx_json).to.have.property('Destination');
    expect(tx.tx_json).to.have.property('Fee');
    expect(tx.tx_json).to.have.property('Flags');
    expect(tx.tx_json).to.have.property('LastLedgerSequence');
    expect(tx.tx_json).to.have.property('Sequence');

    expect(tx).to.have.property('hash');
    expect(tx.hash).to.equal(txid);
    expect(tx).to.have.property('blockHash').that.is.a('string');

    expect(tx).to.have.property('meta');
    expect(tx.meta).to.have.property('delivered_amount').that.is.a('string');

    // Old expectations
    // expect(tx).to.have.property('Account');
    // expect(tx).to.have.property('Amount');
    // expect(tx).to.have.property('Destination');
    // expect(tx).to.have.property('Fee');
    // expect(tx).to.have.property('Flags');
    // expect(tx).to.have.property('LastLedgerSequence');
    // expect(tx).to.have.property('Sequence');
    // expect(tx).to.have.property('blockHash');
    // expect(tx.hash).to.equal(txid);
    // expect(tx).to.have.property('blockHash');
    // expect(tx.blockHash).to.not.be.undefined;
  });

  it('should return nothing for unknown transaction', async () => {
    let unknownTx;
    try {
      unknownTx = await rpcs.getTransaction({ currency, txid });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(unknownTx === null);
  });

  it('should be able to get a raw transaction', async () => {
    let tx;
    try {
      tx = await rpcs.getRawTransaction({ currency, txid });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(tx.length).to.be.greaterThan(300);
  });

  it('should return nothing for unknown raw transaction', async () => {
    let tx;
    try {
      tx = await rpcs.getRawTransaction({ currency, txid: 'E08D6E9754025BA2534A78707605E0601F03ACE063687A0CA1BDDACFCD1698C7' });
    } catch (err) {
      expect(err).to.not.exist();
    }
    expect(tx === null);
  });

  describe('getTransactions', () => {
    const sender = config.address;
    const senderSeed = 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb';
    const recipient1 = 'r38UsJxHSJKajC8qcNmofxJvCESnzmx7Ke';
    const recipient2 = 'rMGhv5SNsk81QN1fGu6RybDkUi2of36dua';
    const recipient3 = 'r4ip6t3NUe4UWguLUJCbyojxG6PdPZg9EJ';
    const recipient4 = 'rwtFtAMNXPoq4xgxn3FzKKGgVZErdcuLST';
    const senderAddress_ed25519 = 'rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf';

    before(async () => {
      await xrpRPC.rpc.connect();
      const initialServerInfo = await xrpRPC.rpc.request({ command: 'server_info' });
      const initialSeq = initialServerInfo.result.info.validated_ledger.seq;

      const payToArray = [recipient1, recipient2, recipient3, recipient4]
        .map((recipient, index) => ({ id: index, address: recipient, amount: 10000 * (index + 1) }));
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
      const outputArray = await rpcs.unlockAndSendToAddressMany({ payToArray, secret: senderSeed });
      await emitPromise;
      expect(outputArray).to.have.lengthOf(4);
      await xrpRPC.rpc.request({ command: 'ledger_accept' });
      
      let currentSeq;
      do {
        const response = await xrpRPC.rpc.request({ command: 'server_info' });
        currentSeq = response.result.info.validated_ledger.seq;
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (currentSeq <= initialSeq);
    });
    it('should be able to get many transactions', async () => {
      const address = sender;
      /** @type {xrpl.AccountTxResponse['result']} */
      const result = await xrpRPC.getTransactions({ address });
      expect(result).to.have.property('account', address);
      expect(result).to.have.property('ledger_index_max').that.is.a('number');
      expect(result).to.have.property('ledger_index_min').that.is.a('number');
      expect(result).to.have.property('limit').that.is.a('number');
      expect(result).to.have.property('transactions').that.is.an('array');
      expect(result).to.have.property('validated').that.is.a('boolean');
      expect(result.transactions).to.have.lengthOf.above(0);

      const tx = result.transactions[0];
      // New expectations
      expect(tx).to.have.property('tx_json');
      expect(tx.tx_json).to.have.property('Account');
      expect(tx.tx_json).to.have.property('Destination');
      expect(tx.tx_json).to.have.property('Fee');
      expect(tx.tx_json).to.have.property('Flags');
      expect(tx.tx_json).to.have.property('LastLedgerSequence');
      expect(tx.tx_json).to.have.property('Sequence');
  
      expect(tx).to.have.property('hash');
      // expect(tx.hash).to.equal(txid);
      // expect(tx).to.have.property('blockHash').that.is.a('string');
  
      expect(tx).to.have.property('meta');
      expect(tx.meta).to.have.property('delivered_amount').that.is.a('string');

      // Old expectations
      // expect(tx).to.have.property('meta');
      // expect(tx).to.have.property('tx');
      // expect(tx.meta).to.have.property('delivered_amount').that.is.a('string');
      // expect(tx.tx).to.have.property('Account').that.is.a('string');
      // expect(tx.tx).to.have.property('Amount').that.is.a('string');
      // expect(tx.tx).to.have.property('DeliverMax').that.is.a('string');
      // expect(tx.tx).to.have.property('Destination').that.is.a('string');
      // expect(tx.tx).to.have.property('Fee').that.is.a('string');
      // expect(tx.tx).to.have.property('Flags').that.is.a('number');
      // expect(tx.tx).to.have.property('LastLedgerSequence').that.is.a('number');
      // expect(tx.tx).to.have.property('Sequence').that.is.a('number');
      // expect(tx.tx).to.have.property('SigningPubKey').that.is.a('string');
      // expect(tx.tx).to.have.property('TransactionType', 'Payment');
      // expect(tx.tx).to.have.property('TxnSignature').that.is.a('string');
      // expect(tx.tx).to.have.property('date').that.is.a('number');
      // expect(tx.tx).to.have.property('hash').that.is.a('string');
      // expect(tx.tx).to.have.property('inLedger').that.is.a('number');
      // expect(tx.tx).to.have.property('ledger_index').that.is.a('number');
    });
    it('should return an empty array if account isn\'t found', async () => {
      // Public key from wrong algorithm
      const result = await xrpRPC.getTransactions({ address: senderAddress_ed25519 });
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
    it('should throw RippledError: Missing field "account" if address undefined', async () => {
      try {
        await xrpRPC.getTransactions({ address: undefined });
        expect.fail('Expected error was not thrown');
      } catch (err) {
        expect(err).to.have.property('data');
        const { data } = err;
        expect(data).to.have.property('error', 'invalidParams');
        expect(data).to.have.property('error_code', 31);
        expect(data).to.have.property('error_message', 'Missing field \'account\'.');
      }
    });
    it('should throw RippledError: Account malformed if bad address', async () => {
      try {
        await xrpRPC.getTransactions({ address: 'badAddress' });
        expect.fail('Expected error was not thrown');
      } catch (err) {
        expect(err).to.have.property('data');
        const { data } = err;
        expect(data).to.have.property('error', 'actMalformed');
        expect(data).to.have.property('error_code', 35);
        expect(data).to.have.property('error_message', 'Account malformed.');
      }
    });
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
    expect(tip).to.have.property('hash').that.is.a('string');
    expect(tip).to.have.property('height').that.is.a('number');
  });

  it('should get confirmations', async () => {
    let confirmationsBefore = await rpcs.getConfirmations({ currency, txid });
    assert(confirmationsBefore != undefined);
    let { result:acceptance} = await xrpRPC.asyncRequest('ledger_accept');
    assert(acceptance);
    expect(acceptance).to.have.property('ledger_current_index');
    let confirmationsAfter = await rpcs.getConfirmations({ currency, txid });
    expect(confirmationsAfter - confirmationsBefore).to.eq(1);
  });

  it('should not return confirmations for unknown transaction', async () => {
    let confirmations = await rpcs.getConfirmations({ currency, txid });
    expect(confirmations === null);
  });

  it('should validate address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: config.currencyConfig.sendTo });
    assert(isValid === true);
  });

  it('should not validate bad address', async () => {
    const isValid = await rpcs.validateAddress({ currency, address: 'NOTANADDRESS' });
    assert(isValid === false);
  });

  it('should get account info', async () => {
    const accountInfo = await rpcs.getAccountInfo({ currency, address: config.address });
    expect(accountInfo).to.have.property('account_data');
    expect(accountInfo.account_data).to.have.property('Balance');
    expect(accountInfo.account_data).to.have.property('Flags');
    expect(accountInfo.account_data).to.have.property('index');
    expect(accountInfo.account_data).to.have.property('LedgerEntryType');
    expect(accountInfo.account_data).to.have.property('OwnerCount');
    expect(accountInfo.account_data).to.have.property('PreviousTxnID');
    expect(accountInfo.account_data).to.have.property('PreviousTxnLgrSeq');
    expect(accountInfo.account_data).to.have.property('Sequence');
  });

  it('should get server info', async () => {
    const serverInfo = await rpcs.getServerInfo({ currency });
    expect(serverInfo).to.have.property('complete_ledgers');
    expect(serverInfo).to.have.property('server_state');
    expect(serverInfo).to.have.property('uptime');
    expect(serverInfo).to.have.property('validated_ledger');
    expect(serverInfo.validated_ledger).to.have.property('reserve_base_xrp');
  });

  it('should disconnect from rpc when idle', async () => {
    await rpcs.getTip({ currency });
    assert(xrpRPC.rpc.isConnected() === true, 'connection should be connected');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert(xrpRPC.rpc.isConnected() === false, 'connection should be disconnected');
  });

  it('should handle emitted connection errors from rpc with noop', async () => {
    xrpRPC.rpc.emit('error', new Error('connection error xrp'));
  });
});
