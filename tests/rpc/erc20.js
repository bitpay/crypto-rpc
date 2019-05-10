const { CryptoRpc } = require('../..');
const config = require('./config');
const assert = require('assert');
const mocha = require('mocha');
const { before, describe, it } = mocha;

const currencyConfig = {
  sendTo: '0xA15035277A973d584b1d6150e93C21152D6Af440',
  unlockPassword: '',
  privateKey:
      '117ACF0C71DE079057F4D125948D2F1F12CB3F47C234E43438E1E44C93A9C583',
  rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
};

describe('ERC20 Tests', function() {
  let txid = '';
  const currency = 'ERC20';
  const rpcs = new CryptoRpc(config);


  this.timeout(10000);

  before(done => {
    setTimeout(done, 5000);
  });

  it('should be able to get a balance', async () => {
    const balance = await rpcs.getBalance({ currency });
    assert(balance != undefined);
  });

  it('should be able to send a transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: currencyConfig.sendTo, amount: '10000', passphrase: currencyConfig.unlockPassword });
    assert(txid);
  });

  it('should be able to send a big transaction', async () => {
    txid = await rpcs.unlockAndSendToAddress({ currency, address: currencyConfig.sendTo, amount: 1e23, passphrase: currencyConfig.unlockPassword });
    assert(txid);
  });

  it('should be able to send many transactions', async () => {
    const address = currencyConfig.sendTo;
    const amount = '1000';
    const payToArray = [
      { address, amount },
    ];
    const txids = await rpcs.unlockAndSendToAddressMany({ currency, payToArray, passphrase: currencyConfig.unlockPassword });
    assert(txids[0]);
  });

  it('should reject when one of many transactions fails', async () => {
    const address = currencyConfig.sendTo;
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

  it('should be able to decode a raw transaction', async () => {
    const { rawTx } = currencyConfig;
    assert(rawTx);
    const decoded = await rpcs.decodeRawTransaction({ currency, rawTx });
    assert(decoded);
  });
});

