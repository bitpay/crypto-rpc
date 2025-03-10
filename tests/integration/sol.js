
const SolKit = require('@solana/kit');
const SolSystem = require('@solana-program/system');
const { pipe } = require('@solana/functional');
const SolRPC = require('../../lib/sol/SolRpc');
const { expect } = require('chai');
const assert = require('assert');

const config = {
  chain: 'SOL',
  host: 'api.devnet.solana.com',
  protocol: 'https',
  currencyConfig: {
    privateKey1: 'H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9',
    privateKey2: 'CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'
  }
};

describe('SolRpc Integration tests', () => {
  /** @type {SolRPC} */
  let solRpc;

  /** @type {import("@solana/kit").KeyPairSigner<string>} */
  let senderKeypair;
  /** @type {import("@solana/kit").KeyPairSigner<string>} */
  let receiverKeypair;
  /** @type {import("@solana/kit").KeyPairSigner<string>} */
  let nonceAccountKeypair;

  before(async function () {
    this.timeout(10000);
    const bs58Encoder = SolKit.getBase58Encoder();
    const [keypairSigner1Value, keypairSigner2Value] = await Promise.all(
      Object.values(config.currencyConfig)
        .map(async (key) => SolKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(key)))
    );

    // For these tests, the nonce authority will be the sender
    senderKeypair = keypairSigner1Value;
    receiverKeypair = keypairSigner2Value;

    solRpc = new SolRPC(config);

    // Create nonce account
    nonceAccountKeypair = await SolKit.generateKeyPairSigner();
    await createNonceAccount(solRpc, senderKeypair, nonceAccountKeypair);
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

  describe('estimateMaxPriorityFee', () => {
    it('returns a number representing the priority fee at the nth percentile of ordered recent prioritization fees', async () => {
      const retVal = await solRpc.estimateMaxPriorityFee({});
      expect(retVal).to.be.a('number');
      expect(retVal).to.be.greaterThanOrEqual(0);
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

  const assertValidTransaction = (retVal) => {
    const numberTargetType = 'bigint';

    expect(retVal).to.be.an('object');
    expect(retVal).to.have.property('blockTime').that.is.a(numberTargetType);
    expect(retVal).to.have.property('meta').that.is.an('object');
    expect(retVal).to.have.property('transaction').that.is.an('object');
    expect(retVal).to.have.property('slot').that.is.a(numberTargetType);
    expect([0n, 'legacy'].includes(retVal.version)).to.be.true;
    const { meta, transaction } = retVal;

    // Check meta
    expect(meta).to.have.property('preBalances').that.is.an('array');
    expect(meta.preBalances.every(balance => typeof balance === numberTargetType)).to.be.true;

    expect(meta).to.have.property('postBalances').that.is.an('array');
    expect(meta.postBalances.every(balance => typeof balance === numberTargetType)).to.be.true;

    expect(meta).to.have.property('preTokenBalances').that.is.an('array');
    expect(meta.preTokenBalances.every(balance => typeof balance === numberTargetType)).to.be.true;

    expect(meta).to.have.property('postTokenBalances').that.is.an('array');
    expect(meta.postTokenBalances.every(balance => typeof balance === numberTargetType)).to.be.true;

    // Check transaction
    expect(transaction).to.have.property('message').that.is.an('object');
    expect(transaction).to.have.property('signatures').that.is.an('array');
    const { message, signatures } = transaction;
    // expect(message).to.have.property('staticAccountKeys').that.is.an('array');
    // message.staticAccountKeys.forEach(key => {
    //     expect(key).to.be.an.instanceof(PublicKey);
    // });
    expect(message).to.have.property('accountKeys').that.is.an('array');
    expect(message.accountKeys.every(accountKey => typeof accountKey === 'string')).to.be.true;
    expect(signatures.length).to.be.greaterThan(0);
    expect(signatures.every(signature => typeof signature === 'string')).to.be.true;
  };

  describe('getTransaction', () => {
    let versioned_txid;
    let legacy_txid;
    before(async function () {
      this.timeout(10000);
      // const [versionedTxId, legacyTxId] = await Promise.all([
      //     sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 0),
      //     sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 'legacy')
      // ])

      // versioned_txid = versionedTxId;
      // legacy_txid = legacyTxId;
      versioned_txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 0);
      await new Promise(resolve => setTimeout(resolve, 500)); // Add small delay between transactions - allow for listener cleanup
      legacy_txid = await sendTransaction(solRpc, senderKeypair, receiverKeypair, 10000n, 'legacy');
    });

    it('returns a versioned transaction if provided a valid transaction id', async () => {
      const retVal = await solRpc.getTransaction({ txid: versioned_txid });
      expect(retVal.version).to.be.a('bigint');
      expect(Number(retVal.version)).to.equal(0);
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
      targetKeypair = await createAccount(solRpc, senderKeypair);
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
    /** @type {import("@solana/kit").KeyPairSigner} */
    let targetKeypair;
    beforeEach(async function() {
      this.timeout(5e3);
      targetKeypair = await createAccount(solRpc, senderKeypair);
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
      const decodedRawTransaction = solRpc.decodeRawTransaction({ rawTx });
      expect(decodedRawTransaction).to.be.an('object');
      expect(decodedRawTransaction).to.have.property('signatures').that.is.an('array');
      expect(decodedRawTransaction).to.have.property('message').that.is.an('object');
      // eslint-disable-next-line no-unused-vars
      const { signatures: _, message } = decodedRawTransaction;
      expect(message).to.have.property('recentBlockhash').that.is.a('string');
      expect(message).to.have.property('accountKeys').that.is.an('array');
      expect(message).to.have.property('instructions').that.is.an('array');
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
    it('returns a block at provided height', async () => {
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
      expect(block).to.have.property('transactions').that.is.an('array');
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
        expect(newConfirmations).to.be.greaterThan(confirmations);
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

/**
 * 
 * @param {SolRPC} solRpc 
 * @param {import("@solana/kit").KeyPairSigner} feePayerAndAuthorityKeypair 
 * @param {import("@solana/kit").KeyPairSigner} nonceKeypair 
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
 * @param {import("@solana/kit").KeyPairSigner} fromKeypair 
 * @param {import("@solana/kit").KeyPairSigner} toKeypair 
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
 * @param {import("@solana/kit").Rpc} rpc 
 * @param {import("@solana/kit").KeyPairSigner} fromKeypair 
 * @param {import("@solana/kit").KeyPairSigner} toKeypair 
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
 * @param {import("@solana/kit").Rpc} rpc 
 * @param {import("@solana/kit").KeyPairSigner} fromKeypair 
 * @param {import("@solana/kit").KeyPairSigner} toKeypair 
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
 * 
 * @param {SolRPC} solRpc 
 * @param {import("@solana/kit").KeyPairSigner} feePayerKeypair 
 * @param {0 | 'legacy'} version 
 * @returns {Promise<import("@solana/kit").KeyPairSigner>}
 */
async function createAccount(
  solRpc,
  feePayerKeypair,
  version = 0
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
  await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
  return keypair;
}

