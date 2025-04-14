const SolKit = require('@solana/kit');
const SolSystem = require('@solana-program/system');
const { pipe } = require('@solana/functional');
const SolRPC = require('../lib/sol/SolRpc');
const { expect } = require('chai');
const assert = require('assert');
const privateKey1 = require('../blockchain/solana/test/keypair/id.json');
const privateKey2 = require('../blockchain/solana/test/keypair/id2.json');
const SolToken = require('@solana-program/token');
const SOL_ERROR_MESSAGES = require('../lib/sol/error_messages');
const bs58Encoder = SolKit.getBase58Encoder();
const sinon = require('sinon');

describe('SOL Tests', () => {
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
      expect(transferSol).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of transferSol) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('currency').that.is.a('string');
        expect(instruction.currency).to.equal('SOL');
        expect(instruction).to.have.property('destination').that.is.a('string');
        expect(instruction).to.have.property('source').that.is.a('string');
      }
    }

    if (advanceNonceAccount) {
      expect(advanceNonceAccount).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of advanceNonceAccount) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('nonceAccount').that.is.a('string');
        expect(instruction).to.have.property('nonceAuthority').that.is.a('string');
      }
    }

    if (setComputeUnitLimit) {
      expect(setComputeUnitLimit).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of setComputeUnitLimit) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('computeUnitLimit').that.is.a('number').greaterThan(0);
      }
    }

    if (setComputeUnitPrice) {
      expect(setComputeUnitPrice).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of setComputeUnitPrice) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('priority').that.is.a('boolean').that.is.true;
        expect(instruction).to.have.property('microLamports').that.is.a('number').greaterThan(0);
      }
    }

    if (memo) {
      expect(memo).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of memo) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('memo').that.is.a('string');
      }
    }

    if (transferCheckedToken) {
      expect(transferCheckedToken).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of transferCheckedToken) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('authority').that.is.a('string');
        expect(instruction).to.have.property('decimals').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('destination').that.is.a('string');
        expect(instruction).to.have.property('mint').that.is.a('string');
        expect(instruction).to.have.property('source').that.is.a('string');
      }
    }

    if (transferToken) {
      expect(transferToken).to.be.an('array').with.length.greaterThan(0);
      for (const instruction of transferToken) {
        expect(instruction).to.be.an('object');
        expect(instruction).to.have.property('amount').that.is.a('number').that.is.greaterThan(0);
        expect(instruction).to.have.property('authority').that.is.a('string');
        expect(instruction).to.have.property('destination').that.is.a('string');
        expect(instruction).to.have.property('source').that.is.a('string');
      }
    }

    // Add specific instruction checks as needed
  };

  describe('Local tests', function () {
    const config = {
      chain: 'SOL',
      host:  process.env.HOST_SOL || 'solana',
      protocol: 'http',
      port: 8899,
      wsPort: 8900
    };
    
    this.timeout(10e3);
    /** @type {SolRPC} */
    let solRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;
    before(async function () {
      // For these tests, the nonce authority will be the sender
      senderKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey1));
      receiverKeypair = await SolKit.createKeyPairSignerFromBytes(Uint8Array.from(privateKey2));

      solRpc = new SolRPC(config);

      // Airdrop if no money on sender
      const addresses = [senderKeypair.address, receiverKeypair.address];
      for (const address of addresses) {
        const { value: balance } = await solRpc.rpc.getBalance(address).send();
        if (Number(balance) < 1e10) {
          const airdropSignature = await solRpc.rpc.requestAirdrop(address, 1e10).send();
          const { value: statuses } = await solRpc.rpc.getSignatureStatuses([airdropSignature]).send();
          let status = statuses[0];
          let remainingTries = 20;
          while (remainingTries > 0 && status?.confirmationStatus !== 'finalized') {
            await new Promise(resolve => setTimeout(resolve, 250));
            const { value: statuses } = await solRpc.rpc.getSignatureStatuses([airdropSignature]).send();
            status = statuses[0];
            remainingTries--;
          }
  
          if (status !== 'finalized') {
            throw new Error('Balance top-off was not finalized in the specified time interval');
          }
        }
      }

      // Create nonce account
      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(solRpc, senderKeypair, nonceAccountKeypair)
        .catch(reason => {
          throw reason;
        });
    });
    
    describe('getBalance', () => {
      it('can retrieve a balance number for a valid address', async () => {
        const addressString = senderKeypair.address;
        const balance = await solRpc.getBalance({ address: addressString });
        expect(balance).to.be.a('number');
      });
      it('returns null for an invalid address', async () => {
        const invalidAddress = 'Address not on curve';
        const balance = await solRpc.getBalance({ address: invalidAddress });
        expect(balance).to.be.null;
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

    describe('createNonceAccount', () => {
      it('can create a nonce account ', async function () {
        this.timeout(5000);
        const nonceKeypair = await SolKit.generateKeyPairSigner();
        const retVal = await solRpc.createNonceAccount(senderKeypair, nonceKeypair);
        expect(retVal).to.be.a('string');
      });
    });

    describe('estimateFee', () => {
      it('calls estimateTransactionFee is rawTx is included and returns number if rawTx is valid', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const retVal = await solRpc.estimateFee({ rawTx });
        expect(retVal).to.be.a('number');
        expect(retVal).to.be.greaterThanOrEqual(0);
      });
      it('returns a number based on the average fee calculator for the last 10 blocks', async function () {
        this.timeout(5000);
        const retVal = await solRpc.estimateFee({});
        expect(retVal).to.be.a('number');
        expect(retVal).to.be.greaterThanOrEqual(0);
      });
      it('throws "Could not decode provided raw transaction" error if rawTx cannot be decoded', async () => {
        const rawTx = 'non dec0dable';
        try {
          await solRpc.estimateFee({ rawTx });
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Could not decode provided raw transaction');
        }
      });
    });

    describe('estimateTransactionFee', () => {
      it('returns a fee estimate number in lamports based on the latest blockhash and transaction message', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const retVal = await solRpc.estimateTransactionFee({ rawTx });
        expect(retVal).to.be.a('number');
        expect(retVal).to.be.greaterThanOrEqual(0);
      });
      it('throws "Could not decode provided raw transaction" if input could not be retrieved', async () => {
        const rawTx = 'non dec0dable';
        try {
          await solRpc.estimateFee({ rawTx });
          expect.fail('Should have thrown an error');
        } catch (err) {
          expect(err.message).to.equal('Could not decode provided raw transaction');
        }
      });
    });

    describe('addPriorityFee', () => {
      it('adds a priority fee to the provided transaction message', async () => {
        const transactionMessage = await createUnsignedTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        assert(!doesTxMsgHaveComputeBudgetInstruction(transactionMessage));

        const appendedTransactionMessage = await solRpc.addPriorityFee({ transactionMessage });
        expect(doesTxMsgHaveComputeBudgetInstruction(appendedTransactionMessage)).to.be.true;

        function doesTxMsgHaveComputeBudgetInstruction(txMsg) {
          return txMsg.instructions.some(instruction => {
            return instruction.programAddress === 'ComputeBudget111111111111111111111111111111';
          });
        }
      });
    });

    describe('getBestBlockHash', () => {
      it('returns a blockhash', async () => {
        const hash = await solRpc.getBestBlockHash();
        expect(hash).to.be.a('string');
      });
    });

    describe('getTransaction', () => {
      let versioned_txid;
      let legacy_txid;
      before(async function () {
        this.timeout(10000);
        versioned_txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 0);
        await new Promise(resolve => setTimeout(resolve, 500)); // Add small delay between transactions - allow for listener cleanup
        legacy_txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 'legacy');
      });

      it('returns a versioned transaction if provided a valid transaction id', async () => {
        const retVal = await solRpc.getTransaction({ txid: versioned_txid });
        assertValidTransaction(retVal);
      });

      it('returns a legacy transaction if provided a valid transaction id', async () => {
        const retVal = await solRpc.getTransaction({ txid: legacy_txid });
        expect(retVal.version).to.equal('legacy');
        assertValidTransaction(retVal);
      });
    });

    describe('getTransactions', () => {
    /** @type {import('@solana/kit').KeyPairSigner<string>} */
      let targetKeypair;
      beforeEach(async function() {
        this.timeout(5e3);
        targetKeypair = await createAccount({ solRpc, feePayerKeypair: senderKeypair });
        for (let i = 0; i < 2; i++) {
          await sendTransaction(solRpc, senderKeypair, targetKeypair, 1000 * (i + 1));
        }
      });

      it('returns an array of at most 1000 non-null transactions for a specified address', async () => {
      // Consider generating a new address here...
        const transactions = await solRpc.getTransactions({ address: targetKeypair.address });
        expect(transactions).to.be.an('array');
        transactions.forEach(transaction => {
          assertValidTransaction(transaction);
        });
      });
    }, 5e3);

    describe('getTransactionCount', () => {
      const numTransactions = 2;
      /** @type {SolKit.KeyPairSigner} */
      let targetKeypair;
      beforeEach(async function() {
        this.timeout(5e3);
        targetKeypair = await createAccount({ solRpc, feePayerKeypair: senderKeypair });
        for (let i = 0; i < numTransactions; i++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          await sendTransaction(solRpc, senderKeypair, targetKeypair, 1000 * (i + 1));
        }
      });

      it('returns the count of confirmed transactions for a valid account address', async () => {
        const count = await solRpc.getTransactionCount({ address: targetKeypair.address });
        expect(count).to.equal(numTransactions + 1); // 1 is the createAccount transaction
      }, 5e3);
    });

    describe('getRawTransaction', () => {
      let txid;
      beforeEach(async function () {
        this.timeout(3500);
        txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n);
      });
      it('returns a base64 encoded string for a valid transaction', async () => {
        const txString = await solRpc.getRawTransaction({ txid });
        expect(txString).to.be.a('string');
        expect(txString).to.equal(Buffer.from(txString, 'base64').toString('base64'));
      });
    });

    describe('decodeRawTransaction', () => {
      it('returns a decoded raw transaction', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const decodedRawTransaction = await solRpc.decodeRawTransaction({ rawTx });
        assertValidTransaction(decodedRawTransaction);
      });
    });

    describe('sendRawTransaction', () => {
      it('sends a raw transaction', async () => {
        const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
        const signature = await solRpc.sendRawTransaction({ rawTx });
        expect(signature).to.be.a('string');
      });
    }); 

    describe('getBlock', () => {
      const assertValidBlock = (block) => {
        const numberTargetType = 'bigint';

        expect(block).to.be.an('object');
        expect(block).to.have.property('blockhash').that.is.a('string');
        expect(block).to.have.property('blockHeight').that.is.a(numberTargetType);
        expect(block).to.have.property('blockTime').that.is.a(numberTargetType);
        expect(block).to.have.property('parentSlot').that.is.a(numberTargetType);
        expect(block).to.have.property('previousBlockhash').that.is.a('string');
        expect(block).to.have.property('rewards').that.is.an('array');
      };
      it('returns a block at provided height and signatures if no "transactionDetails" property passed in', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot });
        assertValidBlock(block);
        expect(block).not.to.have.property('transactions');
        expect(block).to.have.property('signatures').that.is.an('array');
        expect(block.signatures.every(signature => typeof signature === 'string')).to.be.true;
      });
      it('returns a block at provided height and signatures if "transactionDetails: signatures"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot });
        assertValidBlock(block);
        expect(block).not.to.have.property('transactions');
        expect(block).to.have.property('signatures').that.is.an('array');
        expect(block.signatures.every(signature => typeof signature === 'string')).to.be.true;
      });
      it('returns a block at provided height and transactions if "transactionDetails: full"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot, transactionDetails: 'full' });
        assertValidBlock(block);
        expect(block).not.to.have.property('signatures');
        expect(block).to.have.property('transactions').that.is.an('array');
        expect(block.transactions.every(transaction => typeof transaction === 'object')).to.be.true;
      });
      it('returns a block at provided height and transactions if "transactionDetails: accounts"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot, transactionDetails: 'accounts' });
        assertValidBlock(block);
        expect(block).not.to.have.property('signatures');
        expect(block).to.have.property('transactions').that.is.an('array');
        expect(block.transactions.every(transaction => typeof transaction === 'object')).to.be.true;
      });
      it('returns a block at provided height and neither transactions nor signatures if "transactionDetails: none"', async () => {
        const slot = await solRpc.rpc.getSlot().send();
        const block = await solRpc.getBlock({ height: slot, transactionDetails: 'none' });
        assertValidBlock(block);
        expect(block).not.to.have.property('signatures');
        expect(block).not.to.have.property('transactions');
      });
    });

    describe('getLatestSignature', () => {
      it('retrieves the latest signature if found in the max number of blocks to check', async () => {
        try {
          const latestSignature = await solRpc.getLatestSignature();
          expect(latestSignature).to.be.an('object');
          expect(latestSignature).to.have.property('blockHeight').that.is.a('number').greaterThan(0);
          expect(latestSignature).to.have.property('blockTime').that.is.a('number').greaterThan(0);
          expect(latestSignature).to.have.property('signature').that.is.a('string');
        } catch (err) {
          // The catch block handles the expected error of all prior blocks checked not having a signature
          expect(err.message.includes('No signatures found in the last')).to.be.true;
        }
      });
    });

    describe('getConfirmations', () => {
      it('returns the number of confirmations for a valid txid', async function () {
        this.timeout(5000);
        const confirmedTransactionSignature = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 1000);

        await new Promise(resolve => setTimeout(resolve, 250));
        let confirmations = await solRpc.getConfirmations({ txid: confirmedTransactionSignature });
        // Check monotonic increasing number of confirmations over time
        for (let i = 0; i < 2; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const newConfirmations = await solRpc.getConfirmations({ txid: confirmedTransactionSignature });
          expect(newConfirmations).to.be.greaterThanOrEqual(confirmations);
          confirmations = newConfirmations;
        }
      });
    });

    describe('getTip', () => {
      it('returns the slot number as "height" and the corresponding block at that height', async () => {
        const tip = await solRpc.getTip();
        expect(tip).to.be.an('object');
        expect(tip).to.have.property('hash').that.is.a('string');
        expect(tip).to.have.property('height').that.is.a('number');
      });
    });

    describe('getServerInfo', () => {
      it('returns server info', async () => {
        const serverInfo = await solRpc.getServerInfo();
        expect(serverInfo).to.be.an('object');
        expect(serverInfo).to.have.property('feature-set').that.is.a('number');
        expect(serverInfo).to.have.property('solana-core').that.is.a('string');
      });
    });

    describe('Mint tests (requires waiting for transaction finalization in places)', function () {
      const REQUIRED_FRESH_ACCOUNT_NUMBER = 14; // This number should be updated to reflect the number of TESTS (not required test accounts) in this block
      /** @type {SolKit.KeyPairSigner<string>} */
      let mintKeypair;
      let resolvedCreateAccountArray;
      let resolvedCreateAccountIndex = 0;
      /** @type {SolKit.KeyPairSigner<string>} */
      let testKeypair;
      before(async function () {
        this.timeout(40e3); // Setup requires awaiting finalization of transactions
        // Create mint
        mintKeypair = await SolKit.generateKeyPairSigner();
        await createMint({ solRpc, payer: senderKeypair, mint: mintKeypair, mintAuthority: senderKeypair });

        // createAccount waits for transaction finalization. This takes a lot of time. Processing in parallel mitigates this issue to a large extent.
        // Update REQUIRED_FRESH_ACCOUNT_NUMBER when adding/removing tests to the "getOrCreateAta" describe block.
        resolvedCreateAccountArray = await Promise.all(
          Array(REQUIRED_FRESH_ACCOUNT_NUMBER).fill(0)
            .map(async () => createAccount({ solRpc, feePayerKeypair: senderKeypair, version: 'legacy', commitment: 'finalized' }))
        );
      });

      beforeEach(function () {
        testKeypair = resolvedCreateAccountArray[resolvedCreateAccountIndex];
        resolvedCreateAccountIndex++;
      });

      describe('deriveAta', function() {
        it('can find the associated token address string given a valid solAddress and mint address', async () => {
          const destinationAta = await solRpc.deriveAta({ solAddress: testKeypair.address, mintAddress: mintKeypair.address });
          expect(destinationAta).to.be.a('string');
        });
        it('throws an error if a provided param is non-base58', async () => {
          try {
            await solRpc.deriveAta({ solAddress: 'invalid string', mintAddress: mintKeypair.address });
            assert.fail('Test failed: deriveAta did not throw as expected');
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.NON_BASE58_PARAM);
          }
        });
        it('throws an error if a provided param is missing', async () => {
          try {
            await solRpc.deriveAta({ mintAddress: mintKeypair.address });
            assert.fail('Test failed: deriveAta did not throw as expected');
          } catch (err) {
            expect(err.message).to.equal('Cannot read properties of undefined (reading \'length\')');
          }
        });
        it('returns a string even if mint address does not correspond to a valid mint', async () => {
          const notMintKeypair = await SolKit.generateKeyPairSigner();
          const destinationAta = await solRpc.deriveAta({ solAddress: testKeypair.address, mintAddress: notMintKeypair.address });
          expect(destinationAta).to.be.a('string');
        });
      });
      describe('getConfirmedAta', function () {
        this.timeout(20e3);
        it('Retrieves ATA address string', async function () {
          const createdAta = await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          const result = await solRpc.getConfirmedAta({ solAddress: testKeypair.address, mintAddress: mintKeypair.address });
          expect(result).to.equal(createdAta);
        });
        it(`Throws "${SOL_ERROR_MESSAGES.ATA_NOT_INITIALIZED}" if ATA not found`, async () => {
          try {
            await solRpc.getConfirmedAta({ solAddress: testKeypair.address, mintAddress: mintKeypair.address });
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.ATA_NOT_INITIALIZED);
          }
        });
        it(`Throws ${SOL_ERROR_MESSAGES.UNSPECIFIED_INVALID_PARAMETER} if passed in address not found`, async () => {
          try {
            await solRpc.getConfirmedAta({ solAddress: 'invalid sol address', mintAddress: mintKeypair.address });
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.UNSPECIFIED_INVALID_PARAMETER);
          }
        });
        it(`Throws "${SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER}" if passed in mint not a mint`, async () => {
          const validBase58String = (await SolKit.generateKeyPairSigner()).address;
          try {
            await solRpc.getConfirmedAta({ solAddress: testKeypair.address, mintAddress: validBase58String });
          } catch (err) {
            expect(err.message).to.equal(SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER);
          }
        });
      });
      describe('createAta', function () {
        this.timeout(20e3);
        // Spy on the three possible factory methods for generating a method to send a transaction
        let sendAndConfirmFactorySpy;
        let sendAndConfirmDurableNonceFactorySpy;
        let sendTransactionWithoutConfirmingFactorySpy;
        beforeEach(async function () {
          sendAndConfirmFactorySpy = sinon.spy(SolKit, 'sendAndConfirmTransactionFactory');
          sendAndConfirmDurableNonceFactorySpy = sinon.spy(SolKit, 'sendAndConfirmDurableNonceTransactionFactory');
          sendTransactionWithoutConfirmingFactorySpy = sinon.spy(SolKit, 'sendTransactionWithoutConfirmingFactory');
        });

        afterEach(function () {
          sinon.restore();
        });

        it('returns retrieved ata if it already exists', async () => {
          const createdAta = await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          sendAndConfirmFactorySpy.resetHistory();
          sendAndConfirmDurableNonceFactorySpy.resetHistory();
          sendTransactionWithoutConfirmingFactorySpy.resetHistory();

          const result = await solRpc.createAta({ ownerAddress: testKeypair.address, mintAddress: mintKeypair.address });
          expect(result).to.be.an('object');
          expect(result).to.have.property('action').that.equals('RETRIEVED');
          expect(result).to.have.property('ataAddress').that.equals(createdAta);
          expect(result).to.have.property('message').that.equals('The ATA was previously initialized.');

          // Additional tests ensure that no transaction was sent
          expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
          expect(sendAndConfirmDurableNonceFactorySpy.callCount).to.equal(0);
          expect(sendTransactionWithoutConfirmingFactorySpy.callCount).to.equal(0);
        });
        it('does not create a transaction message if getAta throws any error that is not ata not initialized error', async function () {
          const invalidMintAddress = (await SolKit.generateKeyPairSigner()).address;
          const expectedErrorMessage = SOL_ERROR_MESSAGES.INVALID_MINT_PARAMETER;
          sendAndConfirmFactorySpy.resetHistory();
          sendAndConfirmDurableNonceFactorySpy.resetHistory();
          sendTransactionWithoutConfirmingFactorySpy.resetHistory();

          try {
            await solRpc.createAta({ ownerAddress: testKeypair.address, mintAddress: invalidMintAddress });
          } catch (err) {
            expect(err.message).to.equal(expectedErrorMessage);
          } finally {
            expect(sendAndConfirmFactorySpy.callCount).to.equal(0);
            expect(sendAndConfirmDurableNonceFactorySpy.callCount).to.equal(0);
            expect(sendTransactionWithoutConfirmingFactorySpy.callCount).to.equal(0);
          }
        });
        it('can create an ata', async () => {
          const result = await solRpc.createAta({ ownerAddress: testKeypair.address, mintAddress: mintKeypair.address, feePayer: senderKeypair });
          expect(result).to.be.an('object');
          expect(result).to.have.property('action').that.equals('CREATED');
          expect(result).to.have.property('ataAddress').that.is.a('string');
          expect(result).to.have.property('signature').that.is.a('string');
          expect(result).to.have.property('message').that.equals('The ATA is initialized.');
        });
      });
      describe('getAccountInfo', function () {
        this.timeout(20e3);
        it('can return an account balance and array of associated tokens', async () => {
          // Setup
          await createAta({ solRpc, owner: testKeypair.address, mint: mintKeypair.address, payer: senderKeypair });
          
          // Execution
          const result = await solRpc.getAccountInfo({ address: testKeypair.address });
          
          
          // Assertions
          expect(result).to.be.an('object');
          expect(result).not.to.be.null;
          expect(result).to.have.property('lamports').that.is.a('number').greaterThan(0);
          expect(result).to.have.property('atas').that.is.an('array').with.length(1);
          for (const ata of result.atas) {
            expect(ata).to.be.an('object');
            expect(ata).to.have.property('mint').that.is.a('string');
            expect(ata).to.have.property('pubkey').that.is.a('string').not.equal(testKeypair.address);
            expect(ata).to.have.property('state').that.is.a('string');
          }
        });
        it('can return an account balance and empty array of associated tokens', async () => {
          const result = await solRpc.getAccountInfo({ address: testKeypair.address });
          expect(result).to.be.an('object');
          expect(result).not.to.be.null;
          expect(result).to.have.property('lamports').that.is.a('number').greaterThan(0);
          expect(result).to.have.property('atas').that.is.an('array').with.length(0);
        });
        it('does something or the other if the provided address is not associated with an account', async () => {
          const newKeypair = await SolKit.generateKeyPairSigner();
          const result = await solRpc.getAccountInfo({ address: newKeypair.address });
          expect(result).to.be.null;
        });
      });
    });

    describe('isBase58', () => {
      it('returns true if a string is valid base58', () => {
        const isBase58 = solRpc.isBase58(receiverKeypair.address);
        expect(isBase58).to.be.true;
      });
      it('returns false if a string is invalid base58', () => {
        const isBase58 = solRpc.isBase58('l1O0');
        expect(isBase58).to.be.false;
      });
    });
  });
  describe('Devnet tests', function () {
    this.timeout(10e4);
    const config = {
      chain: 'SOL',
      host: 'api.devnet.solana.com',
      protocol: 'https'
      // Do not include ports
    };
    
    /** @type {SolRPC} */
    let solRpc;
    /** @type {SolKit.KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let nonceAccountKeypair;
    /** @type {SolKit.KeyPairSigner<string>} */
    let mintKeypair;

    before(async function () {
      senderKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9'));
      receiverKeypair = await SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode('CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'));

      solRpc = new SolRPC(config);
      nonceAccountKeypair = await SolKit.generateKeyPairSigner();
      await createNonceAccount(solRpc, senderKeypair, nonceAccountKeypair);
      // Ensure sender and receiver are properly funded - this is important because although the value is held constant, transaction fees are taken out

      const { value: senderBalance } = await solRpc.rpc.getBalance(senderKeypair.address).send();
      const { value: receiverBalance } = await solRpc.rpc.getBalance(receiverKeypair.address).send();
      const THRESHOLD_LAMPORTS = 100000;
      if (!(Number(senderBalance) >= THRESHOLD_LAMPORTS && Number(receiverBalance) >= THRESHOLD_LAMPORTS)) {
        console.warn('Devnet accounts need more funds');
      }

      // Create mint
      mintKeypair = await SolKit.generateKeyPairSigner();
      await createMint({ solRpc, payer: senderKeypair, mint: mintKeypair, mintAuthority: senderKeypair });
    });

    describe('Transaction tests', () => {
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
    it('can retrieve a balance', async () => {
      const addressString = senderKeypair.address;
      const balance = await solRpc.getBalance({ address: addressString });
      expect(balance).to.be.a('number');
    });
    it('can estimate a fee on a raw transaction', async () => {
      const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
      const retVal = await solRpc.estimateFee({ rawTx });
      expect(retVal).to.be.a('number');
      expect(retVal).to.be.greaterThanOrEqual(0);
    });
    it('can calculate a max priority fee', async () => {
      const retVal = await solRpc.estimateMaxPriorityFee({});
      expect(retVal).to.be.a('number');
      expect(retVal).to.be.greaterThanOrEqual(0);
    });
    it('can get most recent blockhash', async () => {
      const hash = await solRpc.getBestBlockHash();
      expect(hash).to.be.a('string');
    });
    it('can get the most recent block', async () => {
      const numberTargetType = 'bigint';

      const slot = await solRpc.rpc.getSlot().send();
      const block = await solRpc.getBlock({ height: slot });
      expect(block).to.be.an('object');
      expect(block).to.have.property('blockhash').that.is.a('string');
      expect(block).to.have.property('blockHeight').that.is.a(numberTargetType);
      expect(block).to.have.property('blockTime').that.is.a(numberTargetType);
      expect(block).to.have.property('parentSlot').that.is.a(numberTargetType);
      expect(block).to.have.property('previousBlockhash').that.is.a('string');
      expect(block).to.have.property('rewards').that.is.an('array');
      expect(block).to.have.property('signatures').that.is.an('array');
    });
    it('can get the most recent slot and its blockhash', async () => {
      const tip = await solRpc.getTip();
      expect(tip).to.be.an('object');
      expect(tip).to.have.property('hash').that.is.a('string');
      expect(tip).to.have.property('height').that.is.a('number');
    });
    it('can get server state info', async () => {
      const serverInfo = await solRpc.getServerInfo();
      expect(serverInfo).to.be.an('object');
      expect(serverInfo).to.have.property('feature-set').that.is.a('number');
      expect(serverInfo).to.have.property('solana-core').that.is.a('string');
    });
    it('can retrieve account info including lamports and ata array', async () => {
      const result = await solRpc.getAccountInfo({ address: senderKeypair.address });
      expect(result).to.be.an('object');
      expect(result).not.to.be.null;
      expect(result).to.have.property('lamports').that.is.a('number').greaterThan(0);
      expect(result).to.have.property('atas').that.is.an('array');
      for (const ata of result.atas) {
        expect(ata).to.be.an('object');
        expect(ata).to.have.property('mint').that.is.a('string');
        expect(ata).to.have.property('pubkey').that.is.a('string').not.equal(senderKeypair.address);
        expect(ata).to.have.property('state').that.is.a('string');
      }
    });
    describe('getTokenAccountsByOwner', function () {
      it('can retrieve an array of atas for a previously-confirmed account and skip account existence check', async () => {
        const result = await solRpc.getTokenAccountsByOwner({ address: senderKeypair.address, skipExistenceCheck: true });
        expect(result).to.be.an('array');
        for (const ata of result) {
          expect(ata).to.be.an('object');
          expect(ata).to.have.property('mint').that.is.a('string');
          expect(ata).to.have.property('pubkey').that.is.a('string').not.equal(senderKeypair.address);
          expect(ata).to.have.property('state').that.is.a('string');
        }
      });
      it('throws an expected error if existence check is not skipped and provided address is not found onchain', async () => {
        try {
          const newKeypair = await SolKit.generateKeyPairSigner();
          await solRpc.getTokenAccountsByOwner({ address: newKeypair.address });
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.SOL_ACCT_NOT_FOUND);
        }
      });
      it('returns empty array if existence check skipped and account not found onchain', async () => {
        try {
          const newKeypair = await SolKit.generateKeyPairSigner();
          await solRpc.getTokenAccountsByOwner({ address: newKeypair.address, skipExistenceCheck: true});
        } catch (err) {
          expect(err.message).to.equal(SOL_ERROR_MESSAGES.SOL_ACCT_NOT_FOUND);
        }
      });
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
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    return SolKit.getSignatureFromTransaction(signedTransactionMessage);
  } catch (err) {
    console.error('Error creating nonce account:', err);
    throw err;
  }
}

/**
 * 
 * @param {SolRPC} solRpc 
 * @param {SolKit.KeyPairSigner} fromKeypair 
 * @param {SolKit.KeyPairSigner} toKeypair 
 * @param {number} amountInLamports
 * @param {0|'legacy'} [version=0]
 */
async function sendTransaction(solRpc, fromKeypair, toKeypair, amountInLamports, version = 0) {
  const transaction = await createUnsignedTransaction(solRpc.rpc, fromKeypair, toKeypair, amountInLamports, version);
  const signedTransaction = await SolKit.signTransactionMessageWithSigners(transaction);

  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransaction, { commitment: 'confirmed' });
  return SolKit.getSignatureFromTransaction(signedTransaction);
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
 * @param {SolRPC} params.solRpc 
 * @param {SolKit.KeyPairSigner} params.feePayerKeypair 
 * @param {0 | 'legacy'} params.version
 * @param {'confirmed' | 'finalized'} params.commitment
 * @returns {Promise<SolKit.KeyPairSigner>}
 */
async function createAccount( {
  solRpc,
  feePayerKeypair,
  version = 0,
  commitment = 'confirmed'
}
) {
  const keypair = await SolKit.generateKeyPairSigner();
  const space = 0;
  const rentLamports = await solRpc.rpc.getMinimumBalanceForRentExemption(space).send();
  const createAccountInstruction = SolSystem.getCreateAccountInstruction({
    payer: feePayerKeypair,
    newAccount: keypair,
    lamports: rentLamports,
    space,
    programAddress: SolSystem.SYSTEM_PROGRAM_ADDRESS
  });

  const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    SolKit.createTransactionMessage({ version }),
    (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayerKeypair, tx),
    (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => SolKit.appendTransactionMessageInstruction(createAccountInstruction, tx)
  );

  const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);

  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment });
  return keypair;
}

/**
 * 
 * @param {Object} params
 * @param {SolRPC} params.solRpc
 * @param {SolKit.KeyPairSigner<string>} params.payer
 * @param {SolKit.KeyPairSigner<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.mintAuthority
 * @param {number} params.decimals
 */
async function createMint({ solRpc, payer, mint, mintAuthority, decimals }) {
  const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();
  const mintSpace = SolToken.getMintSize();
  const rentLamports = await solRpc.rpc.getMinimumBalanceForRentExemption(mintSpace).send();

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
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  const signature = SolKit.getSignatureFromTransaction(signedTransactionMessage);
  return signature;
}

/**
 * 
 * @param {Object} params
 * @param {SolRPC} params.solRpc
 * @param {SolKit.Address<string>} params.owner
 * @param {SolKit.Address<string>} params.mint
 * @param {SolKit.KeyPairSigner<string>} params.payer
 */
async function createAta({ solRpc, owner, mint, payer }) {
  const { value: latestBlockhash } = await solRpc.rpc.getLatestBlockhash().send();
  
  const [ata] = await SolToken.findAssociatedTokenPda({
    owner,
    tokenProgram: SolToken.TOKEN_PROGRAM_ADDRESS,
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
  const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: solRpc.rpc, rpcSubscriptions: solRpc.rpcSubscriptions });
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
  return ata;
}
