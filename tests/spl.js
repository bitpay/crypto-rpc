const SolKit = require('@solana/kit');
const SolSystem = require('@solana-program/system');
const SolToken = require('@solana-program/token');
const { pipe } = require('@solana/functional');
const SolRPC = require('../lib/sol/SolRpc');
const SplRPC = require('../lib/sol/SplRpc');
const { expect } = require('chai');
const assert = require('assert');
const privateKey1 = require('../blockchain/solana/test/keypair/id.json');
const privateKey2 = require('../blockchain/solana/test/keypair/id2.json');
const sinon = require('sinon');
const bs58Encoder = SolKit.getBase58Encoder();
const tokenProgramAddress = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('SPL Tests', () => {
  const topLevelConfig = {
    decimals: 6, // As for USDC/USDT
  };
  
  // Reusable assertion set
  const assertValidTransaction = (retVal) => {
    expect(retVal).to.be.an('object');
    expect(retVal).to.have.property('confirmations');
    if (typeof retVal.confirmations === 'number') {
      expect(retVal.confirmations).to.be.a('number').greaterThanOrEqual(0);
    } else {
      expect(retVal.confirmations).to.be.null;
    }
    expect(retVal).to.have.property('status');
    if (retVal.status) {
      expect(['processed', 'confirmed', 'finalized'].includes(retVal.status)).to.be.true;
    } else {
      expect(retVal.status).to.be.null;
    }
    expect(retVal).to.have.property('txid').that.is.a('string');
    expect([0, 'legacy'].includes(retVal.version)).to.be.true;
    
    const { lifetimeConstraint } = retVal;
    if (lifetimeConstraint) {
      expect(lifetimeConstraint).to.be.an('object');
      // Should have blockhash XOR nonce
      const hasBlockhash = lifetimeConstraint.hasOwnProperty('blockhash');
      const hasNonce = lifetimeConstraint.hasOwnProperty('nonce');
      expect(hasBlockhash !== hasNonce).to.be.true; // XOR
      if (hasBlockhash) {
        expect(lifetimeConstraint.blockhash).to.be.a('string');
      } else {
        expect(lifetimeConstraint.nonce).to.be.a('string');
      }
    }


    expect(retVal).to.have.property('instructions').that.is.an('object');
    expect(Array.isArray(retVal.instructions)).to.be.false;
    expect(retVal.instructions).not.to.be.null;

    const {
      transferSol,
      advanceNonceAccount,
      setComputeUnitLimit,
      setComputeUnitPrice,
      memo,
      transferCheckedToken,
      transferToken,
    } = retVal.instructions;
    if (transferSol) {
      expect(transferSol).to.be.an('object');
      expect(transferSol).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
      expect(transferSol).to.have.property('currency').that.is.a('string');
      expect(transferSol.currency).to.equal('SOL');
      expect(transferSol).to.have.property('destination').that.is.a('string');
      expect(transferSol).to.have.property('source').that.is.a('string');
    }

    if (advanceNonceAccount) {
      expect(advanceNonceAccount).to.be.an('object');
      expect(advanceNonceAccount).to.have.property('nonceAccount').that.is.a('string');
      expect(advanceNonceAccount).to.have.property('nonceAuthority').that.is.a('string');
    }

    if (setComputeUnitLimit) {
      expect(setComputeUnitLimit).to.be.an('object');
      expect(setComputeUnitLimit).to.have.property('computeUnitLimit').that.is.a('number').greaterThan(0);
    }

    if (setComputeUnitPrice) {
      expect(setComputeUnitPrice).to.be.an('object');
      expect(setComputeUnitPrice).to.have.property('priority').that.is.a('boolean').that.is.true;
      expect(setComputeUnitPrice).to.have.property('microLamports').that.is.a('number').greaterThan(0);
    }

    if (memo) {
      expect(memo).to.be.an('object');
      expect(memo).to.have.property('memo').that.is.a('string');
    }

    if (transferCheckedToken) {
      expect(transferCheckedToken).to.be.an('object');
      expect(transferCheckedToken).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
      expect(transferCheckedToken).to.have.property('authority').that.is.a('string');
      expect(transferCheckedToken).to.have.property('decimals').that.is.a('number').that.is.greaterThan(0);
      expect(transferCheckedToken).to.have.property('destination').that.is.a('string');
      expect(transferCheckedToken).to.have.property('mint').that.is.a('string');
      expect(transferCheckedToken).to.have.property('source').that.is.a('string');
    }

    if (transferToken) {
      expect(transferToken).to.be.an('object');
      expect(transferToken).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
      expect(transferToken).to.have.property('authority').that.is.a('string');
      expect(transferToken).to.have.property('destination').that.is.a('string');
      expect(transferToken).to.have.property('source').that.is.a('string');
    }

    // Add specific instruction checks as needed
  };

  describe('Inheritance tests', () => {
    let splRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceKeypair;
    
    before(async () => {
      // Setup test keypairs
      senderKeypair = await SolKit.generateKeyPairSigner();
      receiverKeypair = await SolKit.generateKeyPairSigner();
      nonceKeypair = await SolKit.generateKeyPairSigner();
    });

    beforeEach(() => {
      sinon.stub(SolRPC.prototype, 'getBalance').resolves(100);
      sinon.stub(SolRPC.prototype, 'createNonceAccount').resolves('mockSignature');
      sinon.stub(SolRPC.prototype, 'estimateFee').resolves(100);
      sinon.stub(SolRPC.prototype, 'estimateTransactionFee').resolves(100);
      sinon.stub(SolRPC.prototype, 'addPriorityFee').resolves({});
      sinon.stub(SolRPC.prototype, 'getBestBlockHash');
      sinon.stub(SolRPC.prototype, 'getTransaction').resolves({});
      sinon.stub(SolRPC.prototype, 'getTransactions').resolves([]);
      sinon.stub(SolRPC.prototype, 'getTransactionCount').resolves(10);
      sinon.stub(SolRPC.prototype, 'getRawTransaction').resolves('mockRawTx');
      sinon.stub(SolRPC.prototype, 'decodeRawTransaction').resolves({});
      sinon.stub(SolRPC.prototype, 'sendRawTransaction').resolves('mockSignature');
      sinon.stub(SolRPC.prototype, 'getBlock').resolves({});
      sinon.stub(SolRPC.prototype, 'getLatestFinalizedBlock').resolves({});
      sinon.stub(SolRPC.prototype, 'getLatestSignature').resolves({});
      sinon.stub(SolRPC.prototype, 'getConfirmations').resolves({});
      sinon.stub(SolRPC.prototype, 'getTip').resolves({});
      sinon.stub(SolRPC.prototype, 'getServerInfo').resolves({});
    
      // Create test instance after stubbing parent methods
      splRpc = new SplRPC({
        chain: 'SOL',
        host: 'localhost',
        protocol: 'http',
        port: 8899,
        wsPort: 8900
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('inherits getBalance method from SolRPC', async () => {
      await splRpc.getBalance({ address: receiverKeypair.address });
      expect(SolRPC.prototype.getBalance.callCount).to.equal(1);
    });
    it('inherits createNonceAccount method from SolRPC', async () => {
      await splRpc.createNonceAccount(senderKeypair, nonceKeypair);
      expect(SolRPC.prototype.createNonceAccount.callCount).to.equal(1);
    });
    it('inherits estimateFee method from SolRPC', async () => {
      await splRpc.estimateFee({ rawTx: 'mockRawTx' });
      expect(SolRPC.prototype.estimateFee.callCount).to.equal(1);
    });
    it('inherits estimateTransactionFee method from SolRPC', async () => {
      await splRpc.estimateTransactionFee({ rawTx: 'mockRawTx' });
      expect(SolRPC.prototype.estimateTransactionFee.callCount).to.equal(1);
    });
    it('inherits addPriorityFee method from SolRPC', async () => {
      const transactionMessage = await createUnsignedTransaction(splRpc.rpc, senderKeypair, receiverKeypair, 10);
      await splRpc.addPriorityFee({ transactionMessage });
      expect(SolRPC.prototype.addPriorityFee.callCount).to.equal(1);
    });
    it('inherits getBestBlockHash method from SolRPC', async () => {
      await splRpc.getBestBlockHash();
      expect(SolRPC.prototype.getBestBlockHash.callCount).to.equal(1);
    });
    it('inherits getTransaction method from SolRPC', async () => {
      await splRpc.getTransaction('mockSignature');
      expect(SolRPC.prototype.getTransaction.callCount).to.equal(1);
    });
    it('inherits getTransactions method from SolRPC', async () => {
      await splRpc.getTransactions({ address: 'mockAddress' });
      expect(SolRPC.prototype.getTransactions.callCount).to.equal(1);
    });
    it('inherits getTransactionCount method from SolRPC', async () => {
      await splRpc.getTransactionCount();
      expect(SolRPC.prototype.getTransactionCount.callCount).to.equal(1);
    });
    it('inherits getRawTransaction method from SolRPC', async () => {
      await splRpc.getRawTransaction({ txid: 'mockTxId' });
      expect(SolRPC.prototype.getRawTransaction.callCount).to.equal(1);
    });
    it('inherits decodeRawTransaction method from SolRPC', async () => {
      await splRpc.decodeRawTransaction({ rawTx: 'mockRawTx' });
      expect(SolRPC.prototype.decodeRawTransaction.callCount).to.equal(1);
    });
    it('inherits sendRawTransaction method from SolRPC', async () => {
      await splRpc.sendRawTransaction({ rawTx: 'mockRawTx' });
      expect(SolRPC.prototype.sendRawTransaction.callCount).to.equal(1);
    });
    it('inherits getBlock method from SolRPC', async () => {
      await splRpc.getBlock({ height: 1 });
      expect(SolRPC.prototype.getBlock.callCount).to.equal(1);
    });
    it('inherits getLatestSignature method from SolRPC', async () => {
      await splRpc.getLatestSignature();
      expect(SolRPC.prototype.getLatestSignature.callCount).to.equal(1);
    });
    it('inherits getConfirmations method from SolRPC', async () => {
      await splRpc.getConfirmations({ txid: 'mockTxId' });
      expect(SolRPC.prototype.getConfirmations.callCount).to.equal(1);
    });
    it('inherits getTip method from SolRPC', async () => {
      await splRpc.getTip();
      expect(SolRPC.prototype.getTip.callCount).to.equal(1);
    });
    it('inherits getServerInfo method from SolRPC', async () => {
      await splRpc.getServerInfo();
      expect(SolRPC.prototype.getServerInfo.callCount).to.equal(1);
    });
  });
  describe('Local tests', function () {
    const config = {
      chain: 'SOL',
      host:  process.env.HOST_SOL || 'solana',
      protocol: 'http',
      port: 8899,
      wsPort: 8900
    };
    
    this.timeout(10e3);
    /** @type {SplRPC} */
    let splRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let mintKeypair;
    /** @type {SolKit.Address<string>} */
    let senderAta;
    
    before(async function () {
      this.timeout(10e5);
      // For these tests, the nonce authority will be the sender
      senderKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey1));
      receiverKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey2));

      splRpc = new SplRPC(config);

      // Airdrop if no money on sender
      const { value: senderBalance } = await splRpc.rpc.getBalance(senderKeypair.address).send();
      if (Number(senderBalance) < 1e10) {
        const airdropSignature = await splRpc.rpc.requestAirdrop(senderKeypair.address, 1e10).send();
        const { value: statuses } = await splRpc.rpc.getSignatureStatuses([airdropSignature]).send();
        let status = statuses[0];
        let remainingTries = 10;
        while (remainingTries > 0 && status?.confirmationStatus !== 'finalized') {
          await new Promise(resolve => setTimeout(resolve, 250));
          const { value: statuses } = await splRpc.rpc.getSignatureStatuses([airdropSignature]).send();
          status = statuses[0];
          remainingTries--;
        }

        if (status !== 'finalized') {
          throw new Error('Sender balance top-off was not finalized in the specified time interval');
        }
      }

      // Create nonce account
      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(splRpc, senderKeypair, nonceAccountKeypair)
        .catch(reason => {
          throw reason;
        });

      // Create mint
      mintKeypair = await SolKit.generateKeyPairSigner();
      await createMint({ splRpc, payer: senderKeypair, mint: mintKeypair, mintAuthority: senderKeypair, decimals: topLevelConfig.decimals });
      senderAta = await createAta({ splRpc, owner: senderKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
      await mintTokens({ splRpc, payer: senderKeypair, mint: mintKeypair.address, mintAuthority: senderKeypair, targetAta: senderAta, decimals: topLevelConfig.decimals });
    });

    describe.only('getOrCreateAta', () => {
      /** @type {SolKit.KeyPairSigner<string>} */
      let ownerKeypair;
      let sendAndConfirmFactorySpy;
      beforeEach(async function () {
        // ownerKeypair = await createAccount({ splRpc, feePayerKeypair: senderKeypair, version: 'legacy' });
        sendAndConfirmFactorySpy = sinon.spy(SolKit, 'sendAndConfirmTransactionFactory');
      });

      afterEach(function () {
        sinon.restore();
      });
      it('can create an ata', async () => {
        const result = await splRpc.getOrCreateAta({ owner: ownerKeypair.address, mint: mintKeypair.address, feePayer: senderKeypair });
        expect(result).to.be.a('string');
        // Verify that the creation transaction was sent
        expect(sendAndConfirmFactorySpy.callCount).to.equal(1);
      });

      it('can retrieve an existing ata', async () => {
        // Setup
        const ata = await createAta({ splRpc, owner: ownerKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
        const getTokenAccountsSpy = sinon.spy(splRpc.rpc, 'getTokenAccountsByOwner');
        sendAndConfirmFactorySpy.resetHistory();

        const result = await splRpc.getOrCreateAta({ owner: ownerKeypair.address, mint: mintKeypair.address, feePayer: senderKeypair });
        expect(result).to.be.a('string');
        expect(sendAndConfirmFactorySpy.callCount).to.equal(0);

        const sendPromise = getTokenAccountsSpy.firstCall.returnValue;
        const rpcResult = await sendPromise.send();
        expect(rpcResult).to.have.property('value').that.is.an('array').with.length.greaterThan(0);
        expect(rpcResult.value[0].pubkey).to.equal(ata);

        // Also ensure sendAndconfirmTransactionFactory wasn't called
        expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
      });

      it('does something or the other if invalid mint', async () => {
        const invalidMint = receiverKeypair.address;
        await expect(splRpc.getOrCreateAta({
          owner: ownerKeypair.address,
          mint: invalidMint,
          feePayer: senderKeypair
        })).to.be.rejectedWith(/Invalid public key/);
      });
    });
    
    describe('sendToAddress', () => {
      let inputBase;
      before(() => {
        inputBase = {
          address: receiverKeypair.address,
          amount: 1000,
          fromAccountKeypair: senderKeypair
        };
      });

      it('can send a valid versioned transaction without nonce and without priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          priority: false
        });
        expect(txhash).to.be.a('string');
      });
        
      it('can send a valid versioned transaction with nonce and without priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          nonceAddress: nonceAccountKeypair.address,
          priority: false,
        });
        expect(txhash).to.be.a('string');
      });
        
      it('can send a valid versioned transaction without nonce and with priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid versioned transaction with nonce and with priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 0,
          nonceAddress: nonceAccountKeypair.address,
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction without nonce and without priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy'
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction with nonce and without priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy',
          nonceAddress: nonceAccountKeypair.address,
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction without nonce and with priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy',
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
      it('can send a valid legacy transaction with nonce and with priority flag', async function () {
        this.timeout(10000);
        const txhash = await solRpc.sendToAddress({
          ...inputBase,
          txType: 'legacy',
          nonceAddress: nonceAccountKeypair.address,
          priority: true
        });
        expect(txhash).to.be.a('string');
      });
    
    /** Testing behavior of bad nonce authority would be good */
    });
  });
  describe('Devnet tests', function () {
    this.timeout(1.5e4);
    const config = {
      chain: 'SOL',
      host: 'api.devnet.solana.com',
      protocol: 'https'
      // Do not include ports
    };
    
    this.timeout(15e4);
    /** @type {SplRPC} */
    let splRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let mintKeypair;
    /** @type {SolKit.Address<string>} */
    let senderAta;

    before(async function () {
      senderKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9'));
      receiverKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'));
      splRpc = new SplRPC(config);

      // Ensure sender and receiver are properly funded - this is important because although the value is held constant, transaction fees are taken out
      const { value: senderBalance } = await splRpc.rpc.getBalance(senderKeypair.address).send();
      const { value: receiverBalance } = await splRpc.rpc.getBalance(receiverKeypair.address).send();
      const THRESHOLD_LAMPORTS = 100000;
      if (!(Number(senderBalance) >= THRESHOLD_LAMPORTS && Number(receiverBalance) >= THRESHOLD_LAMPORTS)) {
        console.warn('Devnet accounts need more funds');
      }

      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(splRpc, senderKeypair, nonceAccountKeypair);

      // Create mint
      mintKeypair = await SolKit.generateKeyPairSigner();
      await createMint({ splRpc, payer: senderKeypair, mint: mintKeypair, mintAuthority: senderKeypair, decimals: topLevelConfig.decimals });
      senderAta = await createAta({ splRpc, owner: senderKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
      await mintTokens({ splRpc, payer: senderKeypair, mint: mintKeypair.address, mintAuthority: senderKeypair, targetAta: senderAta, decimals: topLevelConfig.decimals });
    });

    // describe.only('getOrCreateAta', () => {
    //   /** @type {SolKit.KeyPairSigner<string>} */
    //   let ownerKeypair;
    //   let sendAndConfirmFactorySpy;
    //   beforeEach(async function () {
    //     ownerKeypair = await createAccount({ splRpc, feePayerKeypair: senderKeypair, version: 'legacy' });
    //     sendAndConfirmFactorySpy = sinon.spy(SolKit, 'sendAndConfirmTransactionFactory');
    //   });

    //   afterEach(function () {
    //     sinon.restore();
    //   });

    //   it('can create an ata', async () => {
    //     const result = await splRpc.getOrCreateAta({ owner: ownerKeypair.address, mint: mintKeypair.address, feePayer: senderKeypair });
    //     expect(result).to.be.a('string');
    //     // Verify that the creation transaction was sent
    //     expect(sendAndConfirmFactorySpy.callCount).to.equal(1);
    //   });

    //   it('can retrieve an existing ata', async () => {
    //     // Setup
    //     const ata = await createAta({ splRpc, owner: ownerKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
    //     const getTokenAccountsSpy = sinon.spy(splRpc.rpc, 'getTokenAccountsByOwner');
    //     sendAndConfirmFactorySpy.resetHistory();

    //     const result = await splRpc.getOrCreateAta({ owner: ownerKeypair.address, mint: mintKeypair.address, feePayer: senderKeypair });
    //     expect(result).to.be.a('string');
    //     expect(sendAndConfirmFactorySpy.callCount).to.equal(0);

    //     const sendPromise = getTokenAccountsSpy.firstCall.returnValue;
    //     const rpcResult = await sendPromise.send();
    //     expect(rpcResult).to.have.property('value').that.is.an('array').with.length.greaterThan(0);
    //     expect(rpcResult.value[0].pubkey).to.equal(ata);

    //     // Also ensure sendAndconfirmTransactionFactory wasn't called
    //     expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
    //   });

    //   it('does something or the other if invalid mint', async () => {
    //     const invalidMint = receiverKeypair.address;
    //     await expect(splRpc.getOrCreateAta({
    //       owner: ownerKeypair.address,
    //       mint: invalidMint,
    //       feePayer: senderKeypair
    //     })).to.be.rejectedWith(/Invalid public key/);
    //   });
    // });

    // Note: the result of this set of tests should be that the two involved addresses maintain a steady balance, less the transaction fees
    const baseArgs = {
      amount: 10000
    };

    it('can send a versioned transaction, get number of confirmations, and retrieve it', async () => {
      // From sender to receiver 1/2
      const signature = await solRpc.sendToAddress({
        ...baseArgs,
        address: receiverKeypair.address,
        fromAccountKeypair: senderKeypair,
        txType: 0,
        priority: false
      });
      expect(signature).to.be.a('string');

      await new Promise(resolve => setTimeout(resolve, 250));
      let confirmations = await solRpc.getConfirmations({ txid: signature });
      expect(confirmations).to.be.a('number').greaterThanOrEqual(0);
      for (let i = 0; i < 2; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const newConfirmations = await solRpc.getConfirmations({ txid: signature });
        expect(newConfirmations).to.be.a('number').greaterThanOrEqual(confirmations);
        confirmations = newConfirmations;
      }

      const transaction = await solRpc.getTransaction({ txid: signature });
      assertValidTransaction(transaction);
    });
    it('can send a priority, legacy transaction and retrieve it', async () => {
      // From receiver to sender 1/2
      const signature = await solRpc.sendToAddress({
        ...baseArgs,
        address: senderKeypair.address,
        fromAccountKeypair: receiverKeypair,
        txType: 'legacy',
        priority: true
      });
      expect(signature).to.be.a('string');

      const transaction = await solRpc.getTransaction({ txid: signature });
      assertValidTransaction(transaction);
    });
    it('can send a raw transaction, retrieve a raw transaction, and decode it', async () => {
      // From receiver to sender 2/2
      const rawTx = await createRawTransaction(solRpc.rpc, receiverKeypair, senderKeypair, baseArgs.amount);
      const signature = await solRpc.sendRawTransaction({ rawTx }); // Note, this is not necessarily confirmed

      // Wait 5 seconds before looking for transaction
      await new Promise(resolve => setTimeout(resolve, 5000));

      const rawTransaction = await solRpc.getRawTransaction({ txid: signature });
      if (rawTransaction) {
        expect(rawTransaction).to.be.a('string');
        expect(rawTransaction).to.equal(rawTx);
        const decodedRawTransaction = await solRpc.decodeRawTransaction({ rawTx: rawTransaction });
        assertValidTransaction(decodedRawTransaction);
      } else {
        expect(rawTransaction).to.be.null;
      }
    });
    it('can create a nonce account and use it to send a durable nonce transaction', async () => {
      // From sender to receiver 2/2
      const nonceKeypair = await SolKit.generateKeyPairSigner();
      const confirmedSignature = await solRpc.createNonceAccount(senderKeypair, nonceKeypair);
      expect(confirmedSignature).to.be.a('string');

      // Wait 2.5 seconds for transaction to finalize from 'confirmed'
      await new Promise(resolve => setTimeout(resolve, 2500));

      const signature = await solRpc.sendToAddress({
        ...baseArgs,
        address: receiverKeypair.address,
        fromAccountKeypair: senderKeypair,
        nonceAddress: nonceKeypair.address,
        txType: 'legacy'
      });
      expect(signature).to.be.a('string');
    });
  });
});

// Helper functions/**
/**
 * 
 * @param {SolRPC} solRpc 
 * @param {SolKit.KeyPairSigner} feePayerAndAuthorityKeypair 
 * @param {SolKit.KeyPairSigner} nonceKeypair 
 * @returns 
 */
async function createNonceAccount(
  solRpc,
  feePayerAndAuthorityKeypair,
  nonceKeypair
) {
  try {
    // Get the min balance for rent exception
    const space = 80n;
    const lamportsForRent = await solRpc.rpc.getMinimumBalanceForRentExemption(space).send();

    // Build the tx
    const createAccountInstruction = SolSystem.getCreateAccountInstruction({
      payer: feePayerAndAuthorityKeypair,
      newAccount: nonceKeypair,
      lamports: lamportsForRent,
      space,
      programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
    });

    const initializeNonceAccountInstruction = SolSystem.getInitializeNonceAccountInstruction(
      {
        nonceAccount: nonceKeypair.address,
        nonceAuthority: feePayerAndAuthorityKeypair.address
      }
    );

    const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();
    const transactionMessage = pipe(
      SolKit.createTransactionMessage({ version: 0 }),
      (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayerAndAuthorityKeypair, tx), // fix payer
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions(
        [createAccountInstruction, initializeNonceAccountInstruction],
        tx
      )
    );

    // Sign & send
    const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

    const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
    return SolKit.getSignatureFromTransaction(signedTransactionMessage);
  } catch (err) {
    console.error('Error creating nonce account:', err);
    throw err;
  }
}

/**
 * 
 * @param {SolKit.Rpc} rpc 
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports 
 */
async function createRawTransaction(
  rpc,
  fromKeypair,
  toKeypair,
  amountInLamports
) {
  const transaction = await createUnsignedTransaction(rpc, fromKeypair, toKeypair, amountInLamports);
  const signedTransaction = await SolKit.signTransactionMessageWithSigners(transaction);
  const base64EncodedTransaction = SolKit.getBase64EncodedWireTransaction(signedTransaction);
  return base64EncodedTransaction;
}

/**
 * 
 * @param {SolKit.Rpc} rpc 
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports 
 * @param {0 | 'legacy'} [version=0]
 */
async function createUnsignedTransaction(
  rpc,
  fromKeypair,
  toKeypair,
  amountInLamports,
  version = 0
) {
  const { value: recentBlockhash } = await rpc.getLatestBlockhash().send();

  const transferInstruction = SolSystem.getTransferSolInstruction({
    amount: amountInLamports,
    destination: toKeypair.address,
    source: fromKeypair
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(fromKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions([transferInstruction], tx)
  );

  return transactionMessage;
}

/**
 * @param {Object} params
 * @param {SplRPC} params.splRpc 
 * @param {SolKit.KeyPairSigner} params.feePayerKeypair 
 * @param {0 | 'legacy'} params.version - default 0
 * @returns {Promise<SolKit.KeyPairSigner>}
 */
async function createAccount({
  splRpc,
  feePayerKeypair,
  version = 0
}) {
  const keypair = await SolKit.generateKeyPairSigner();
  const space = 0;
  const rentLamports = await splRpc.rpc.getMinimumBalanceForRentExemption(space).send();
  const createAccountInstruction = SolSystem.getCreateAccountInstruction({
    payer: feePayerKeypair,
    newAccount: keypair,
    lamports: rentLamports,
    space,
    programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
  });

  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayerKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstruction(createAccountInstruction, tx)
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  return keypair;
}

/**
 * 
 * @param {Object} params
 * @param {SplRPC} params.splRpc
 * @param {SolKit.Address<string>} params.owner
 * @param {SolKit.Address<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.payer
 */
async function createAta({ splRpc, owner, mint, payer }) {
  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();
  
  const [ata] = await SolToken.findAssociatedTokenPda({
    owner,
    tokenProgram: tokenProgramAddress,
    mint
  });
  
  const createAssociatedTokenIdempotentInstruction = SolToken.getCreateAssociatedTokenIdempotentInstruction({
    payer,
    owner,
    mint,
    ata
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 'legacy' }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions(
      [createAssociatedTokenIdempotentInstruction],
      tx
    )
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  return ata;
}

/**
 * 
 * @param {Object} params
 * @param {SplRPC} params.splRpc
 * @param {SolKit.KeyPairSigner<string>} params.payer
 * @param {SolKit.KeyPairSigner<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.mintAuthority
 * @param {number} params.decimals
 */
async function createMint({ splRpc, payer, mint, mintAuthority, decimals }) {
  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();
  const mintSpace = SolToken.getMintSize();
  const rentLamports = await splRpc.rpc.getMinimumBalanceForRentExemption(mintSpace).send();

  const createAccountInstruction = SolSystem.getCreateAccountInstruction({
    payer,
    newAccount: mint,
    space: mintSpace,
    lamports: rentLamports,
    programAddress: SolToken.TOKEN_PROGRAM_ADDRESS
  });

  const initializeMintInstruction = SolToken.getInitializeMintInstruction({
    mint: mint.address,
    mintAuthority: mintAuthority.address,
    freezeAuthority: null,
    decimals
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 0 }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions(
      [createAccountInstruction, initializeMintInstruction],
      tx
    )
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}

/**
 * 
 * @param {Object} params
 * @param {SplRPC} params.splRpc
 * @param {SolKit.KeyPairSigner<string>} params.payer
 * @param {SolKit.Address<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.mintAuthority
 * @param {SolKit.Address<string>} params.targetAta
 * @param {number} params.decimals
 */
async function mintTokens({ splRpc, payer, mint, mintAuthority, targetAta, decimals }) {
  const { value: latestBlockhash } = await splRpc.rpc.getLatestBlockhash().send();

  const mintToCheckedInstruction = SolToken.getMintToCheckedInstruction({
    mint,
    mintAuthority: mintAuthority.address,
    amount: 1000 * 10 ** decimals,
    decimals,
    token: targetAta
  });

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version: 0 }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstructions(
      [mintToCheckedInstruction],
      tx
    )
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: splRpc.rpc, rpcSubscriptions: splRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}