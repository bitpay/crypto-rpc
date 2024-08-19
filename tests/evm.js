const { CryptoRpc } = require('../');
const {assert, expect} = require('chai');
const mocha = require('mocha');
const sinon = require('sinon');
const { before, describe, it } = mocha;
const ethers = require('ethers');
const util = require('web3-utils');
const chainConfig = require('../lib/eth/chains');

const configs = [
  {
    chain: 'ARB',
    host: 'ganache',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0x30aEB843945055c9d96c4f2E99BF66FF1EF778C7',
    currencyConfig: {
      sendTo: '0xBa1E702D95682023782DD630fdC66E13ded26615',
      unlockPassword: '',
      privateKey: '0x3669381038794f93b2e30f9fc7edc871aec5351e40af833aa049e4c00a25ec8a',
      rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  },
  {
    chain: 'OP',
    host: 'ganache',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0x94BE9Bd3f76B0689a141aED24c149bB6acBa5411',
    currencyConfig: {
      sendTo: '0xe4Fcbfb1c2ddD20d618CDD8E78d8E64aCB835AD0',
      unlockPassword: '',
      privateKey: '0xbc65cb6c016e4e05d56ea272dd2513ab8fb999f85badbd726e2db7e12383b748',
      rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  },
  {
    chain: 'BASE',
    host: 'ganache',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0xB556dc491B7652f73B9D3080A6Cbf2766dB368e9',
    currencyConfig: {
      sendTo: '0x37D3bCDA9d7d5Dc41e32DAd77a5BA89a77aA8BD0',
      unlockPassword: '',
      privateKey: '0x61cad5947d07d2ca69fc57e96c5b79b2927ea263475b17938b2900d0a258faec',
      rawTx:
      '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  },
  {
    chain: 'MATIC',
    host: 'ganache',
    protocol: 'http',
    port: '8545',
    rpcPort: '8545',
    account: '0xf9A09F3Dd46D475B59A9Db149Aca5654A9040E07',
    currencyConfig: {
      sendTo: '0xc0b4dD3941898CB1dAF5cD768Bc1997F77a3D9a5',
      unlockPassword: '',
      privateKey:
        '0x1ac9e617ee805e0e6fab5aff99b960bf464d03e8db5bc73e15419422a81c57e2',
      rawTx:
        '0xf8978202e38471a14e6382ea6094000000000000000000000000000000000000000080b244432d4c353a4e2b4265736a3770445a46784f6149703630735163757a382f4f672b617361655a3673376543676b6245493d26a04904c712736ce12808f531996007d3eb1c1e1c1dcf5431f6252678b626385e40a043ead01a06044cd86fba04ae1dc5259c5b3b5556a8bd86aeb8867e8f1e41512a'
    },
    isEVM: true
  }
];

configs.forEach((config) => {
  describe(`${config.chain} Tests: `, function() {
    const currency = config.chain;
    const currencyConfig = config.currencyConfig;
    const rpcs = new CryptoRpc(config, currencyConfig);
    const evmRPC = rpcs.get(currency);
    let txid = '';
    let blockHash = '';
  
    this.timeout(30000);
  
    before(done => {
      setTimeout(done, 10000);
    });

    afterEach(() => {
      sinon.restore();
    });
  
    it('should estimate fee', async () => {
      const fee = await rpcs.estimateFee({ currency, nBlocks: 4 });
      assert.isDefined(fee);
      expect(fee).to.be.gte(20000000000);
    });

    it('should send raw transaction', async () => {
      // construct the transaction data
      const txData = {
        nonce: 0,
        gasLimit: 25000,
        gasPrice: 2.1*10e9,
        to: config.currencyConfig.sendTo,
        value: Number(util.toWei('123', 'wei'))
      };
      const privateKey = config.currencyConfig.privateKey;
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
          nonce: 1,
          gasLimit: 25000,
          gasPrice: 2.1*10e9,
          to: config.currencyConfig.sendTo,
          value: Number(util.toWei('123', 'wei'))
        };
        const privateKey = config.currencyConfig.privateKey;
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

    it('should estimate fee for type 2 transaction', async () => {
      sinon.spy(evmRPC.web3.eth, 'getBlock');
      let maxFee = await evmRPC.estimateFee({txType: 2, priority: 5});
      assert.isDefined(maxFee);
      expect(maxFee).to.be.equal(5000000000);
      expect(evmRPC.web3.eth.getBlock.callCount).to.equal(1);
    });

    it('should use fee minimums when estimating priority fee for type 2 txs', async () => {
      const maxFee = await evmRPC.estimateMaxPriorityFee({ percentile: 25 });
      const minimumFee = chainConfig[config.chain] ? chainConfig[config.chain].priorityFee : 2.5;
      assert.isDefined(maxFee);
      expect(maxFee).to.be.equal(minimumFee * 1e9);
    });
  
    it('should estimate gas price', async () => {
      const gasPrice = await evmRPC.estimateGasPrice();
      assert.isDefined(gasPrice);
      expect(gasPrice).to.be.gte(20000000000);
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
  
    it('should be able to send a transaction and specify a custom gasPrice', async () => {
      txid = await rpcs.unlockAndSendToAddress({
        currency,
        address: config.currencyConfig.sendTo,
        amount: '10000',
        passphrase: currencyConfig.unlockPassword,
        gasPrice: 30000000000
      });
      let decodedParams = await rpcs.getTransaction({ txid });
      expect(decodedParams.gasPrice).to.equal('30000000000');
      assert.isTrue(util.isHex(txid));
    });
  
    it('should be able to send many transactions', async () => {
      const address = config.currencyConfig.sendTo;
      const amount = '1000';
      const payToArray = [{ address, amount }, {address, amount}];
      const eventEmitter = rpcs.rpcs[config.chain].emitter;
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
      const eventEmitter = rpcs.rpcs[config.chain].emitter;
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
});
