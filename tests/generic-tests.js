const { CryptoRpc } = require('../');
const assert = require('assert');
const mocha = require('mocha');
const {it} = mocha;

module.exports = function TestForCurrency(currency, currencyConfigs) {
  let txid = '';
  let blockHash = '';
  const config = currencyConfigs[currency];
  const currencyConfig = config.currencyConfig;
  const rpcs = new CryptoRpc(config, currencyConfig);

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
    txid = await rpcs.unlockAndSendToAddress({ currency, address: config.currencyConfig.sendTo, amount: '1', passphrase: currencyConfig.unlockPassword });
  });

  it('should be able to get a transaction', async () => {
    const tx = await rpcs.getTransaction({ currency, txid });
    assert(tx);
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
};
