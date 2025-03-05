// const { createKeyPairSignerFromPrivateKeyBytes, getBase58Encoder } = require("@solana/web3.js");
// const { generateKeypair, Keypair, Connection, NONCE_ACCOUNT_LENGTH, SystemProgram, Transaction, sendAndConfirmTransaction, VersionedTransaction, TransactionMessage, PublicKey } = require("@solana/web3.js")
const {
    createKeyPairSignerFromPrivateKeyBytes,
    generateKeyPairSigner,
    getBase58Encoder,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstruction,
    signTransactionMessageWithSigners,
    getBase64EncodedWireTransaction,
    createTransactionMessage,
    appendTransactionMessageInstructions,
} = require("@solana/web3.js");
const { pipe } = require('@solana/functional');

const bs58 = require("bs58");
const SolRPC = require("../../lib/sol/SolRpc");
const { expect } = require("chai");
const { getTransferSolInstruction } = require("@solana-program/system");

const config = {
    chain: 'SOL',
    host: 'api.devnet.solana.com',
    protocol: 'https',
    // Version 2?
    currencyConfig: {
        privateKey1: 'H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9',
        privateKey2: 'CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'
    }
    // Version 1
    // currencyConfig: {
    //     privateKey1: '5nSbM5SQwe7XGBawMLMrNnwxhmaRrPvxPdTRJqCgWQHi5uLWXxov3779QkWYQtx2hjXA6qawfjR5sTZZPQDwNMmp',
    //     privateKey2: '4QvJxAUrcK3NCfSfGE6DdfbjuwNBXnXPPbcWUpnrpxheGp5TdrkCk5XF5GQUyBqFVZpskTET4TrdkN9BosZCP7g1',
    // }
}

describe('SolRpc Integration tests', () => {
    /** @type {SolRPC} */
    let solRpc;

    /** @type {import("@solana/web3.js").KeyPairSigner<string>} */
    let senderKeypair;
    /** @type {import("@solana/web3.js").KeyPairSigner<string>} */
    let receiverKeypair;
    /** @type {import("@solana/web3.js").KeyPairSigner<string>} */
    let nonceAccountKeypair;
    /** @type {import("@solana/web3.js").KeyPairSigner<string>} */
    let nonceAuthorityKeypair;

    before(async () => {
        const bs58Encoder = getBase58Encoder();
        const [keypairSigner1Value, keypairSigner2Value] = await Promise.all(
            Object.values(config.currencyConfig)
                .map(async (key) => { return await createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(key)) })
        );

        // For these tests, the nonce authority will be the sender
        senderKeypair = keypairSigner1Value;
        nonceAuthorityKeypair = senderKeypair;
        receiverKeypair = keypairSigner2Value;
        solRpc = new SolRPC(config);

        // Create nonce account
        nonceAccountKeypair = await generateKeyPairSigner();
    });

    // @DONE
    // describe('getBalance', () => {
    //     it('can retrieve a balance number for a valid address', async () => {
    //         const addressString = senderKeypair.address;
    //         const balance = await solRpc.getBalance({ address: addressString });
    //         expect(balance).to.be.a('number');
    //     })
    //     it('returns null for an invalid address', async () => {
    //         const invalidAddress = 'Address not on curve';
    //         const balance = await solRpc.getBalance({ address: invalidAddress });
    //         expect(balance).to.be.null;
    //     })
    // })

    // DO LAST
    // describe('sendToAddress', () => {
    //     let inputBase;
    //     before(() => {
    //         inputBase = {
    //             address: receiverKeypair.publicKey.toBase58(),
    //             amount: 1000,
    //             fromAccountKeypair: senderKeypair
    //         }
    //     })

    //     it('can send a valid versioned transaction without nonce and without priority flag', async () => {
    //         const txhash = await solRpc.sendToAddress({
    //             ...inputBase,
    //             txType: 0,
    //             priority: false
    //         });
    //         expect(txhash).to.be.a('string');
    //     })
    //     it('can send a valid versioned transaction with nonce and without priority flag', async () => {
    //         const txhash = await solRpc.sendToAddress({
    //             ...inputBase,
    //             txType: 0,
    //             nonceAddress: nonceAccountKeypair.publicKey.toBase58(),
    //             priority: false,
    //         });
    //         expect(txhash).to.be.a('string');
    //     })
    //     // it('can send a valid versioned transaction without nonce and with priority flag', async () => {
    //     //     const txhash = await solRpc.sendToAddress({
    //     //         ...inputBase,
    //     //         txType: 0,
    //     //         priority: true
    //     //     });
    //     //     expect(txhash).to.be.a('string');
    //     // })
    //     // it('can send a valid versioned transaction with nonce and with priority flag', async () => {})
    //     // it('can send a valid legacy transaction without nonce and without priority flag', async () => {})
    //     // it('can send a valid legacy transaction with nonce and without priority flag', async () => {})
    //     // it('can send a valid legacy transaction without nonce and with priority flag', async () => {
    //     //     const txhash = await solRpc.sendToAddress({
    //     //         ...inputBase,
    //     //         txType: 'legacy',
    //     //         priority: true
    //     //     });
    //     //     expect(txhash).to.be.a('string');
    //     // })
    //     // it('can send a valid legacy transaction with nonce and with priority flag', async () => {})
    
    //     /** @TODO Make sure to include test cases where the nonce is used but the sender isn't the authority */
    // })

    // @DONE
    // describe('createNonceAccount', () => {
    //     it('can create a nonce account ', async function () {
    //         this.timeout(3000);
    //         const nonceKeypair = await generateKeyPairSigner();
    //         const retVal = await solRpc.createNonceAccount(senderKeypair, nonceKeypair);
    //         expect(retVal).to.be.a('string');
    //     })
    // })

    // DONE
    // describe('estimateFee', () => {
    //     it('calls estimateTransactionFee is rawTx is included and returns number if rawTx is valid', async () => {
    //         const rawTx = await createRawTransaction(solRpc.rpc, senderKeypair, receiverKeypair, 1000);
    //         const retVal = await solRpc.estimateFee({ rawTx });
    //         expect(retVal).to.be.a('number');
    //         expect(retVal).to.be.greaterThanOrEqual(0);
    //     })
    //     it('returns a number based on the average fee calculator for the last 10 blocks', async function () {
    //         this.timeout(5000);
    //         const retVal = await solRpc.estimateFee({});
    //         expect(retVal).to.be.a('number');
    //         expect(retVal).to.be.greaterThanOrEqual(0);
    //     })
    //     it('throws "Could not decode provided raw transaction" error if rawTx cannot be decoded', async () => {
    //         const rawTx = 'non dec0dable';
    //         try {
    //             await solRpc.estimateFee({ rawTx });
    //             expect.fail('Should have thrown an error');
    //         } catch (err) {
    //             expect(err.message).to.equal('Could not decode provided raw transaction');
    //         }
    //     })
    // })

    // describe('estimateTransactionFee', () => {
    //     it('returns a fee estimate number in lamports based on the latest blockhash and transaction message', async () => {
    //         const rawTx = await createRawTransaction(solRpc.connection, senderKeypair, receiverKeypair, 1000);
    //         const retVal = await solRpc.estimateTransactionFee({ rawTx });
    //         expect(retVal).to.be.a('number');
    //         expect(retVal).to.be.greaterThanOrEqual(0);
    //     })
    //     // Test fails because serialize throws and isn't caught
    //     // it('throws "Could not decode provided raw transaction" if input could not be retrieved', async () => {})
    // })

    // describe('estimateMaxPriorityFee', () => {
    //     it('returns a number representing the priority fee at the nth percentile of ordered recent prioritization fees', async () => {
    //         const retVal = await solRpc.estimateMaxPriorityFee({});
    //         expect(retVal).to.be.a('number');
    //         expect(retVal).to.be.greaterThanOrEqual(0);
    //     })
    // })

    // // @TODO in v2 - method is broken
    // // describe('addPriorityFee', () => {
    // //     it('adds a priority fee to the provided transaction message', async () => {})
    // // })

    // describe('getBestBlockHash', () => {
    //     it('returns a blockhash', async () => {
    //         const hash = await solRpc.getBestBlockHash();
    //         expect(hash).to.be.a('string');
    //     })
    // })

    // const assertValidTransaction = (retVal) => {
    //     expect(retVal).to.be.an('object');
    //     expect(retVal).to.have.property('blockTime').that.is.a('number');
    //     expect(retVal).to.have.property('meta').that.is.an('object');
    //     expect(retVal).to.have.property('transaction').that.is.an('object');
    //     expect(retVal).to.have.property('slot').that.is.a('number');
    //     expect([0, 'legacy'].includes(retVal.version)).to.be.true;
    //     const { meta, transaction } = retVal;

    //     // Check meta
    //     expect(meta).to.have.property('preBalances').that.is.an('array');
    //     expect(meta.preBalances.every(balance => typeof balance === 'number')).to.be.true;

    //     expect(meta).to.have.property('postBalances').that.is.an('array');
    //     expect(meta.postBalances.every(balance => typeof balance === 'number')).to.be.true;

    //     expect(meta).to.have.property('preTokenBalances').that.is.an('array');
    //     expect(meta.preTokenBalances.every(balance => typeof balance === 'number')).to.be.true;

    //     expect(meta).to.have.property('postTokenBalances').that.is.an('array');
    //     expect(meta.postTokenBalances.every(balance => typeof balance === 'number')).to.be.true;

    //     // Check transaction
    //     expect(transaction).to.have.property('message').that.is.an('object');
    //     expect(transaction).to.have.property('signatures').that.is.an('array');
    //     const { message, signatures } = transaction;
    //     expect(message).to.have.property('staticAccountKeys').that.is.an('array');
    //     message.staticAccountKeys.forEach(key => {
    //         expect(key).to.be.an.instanceof(PublicKey);
    //     });
    //     expect(signatures.length).to.be.greaterThan(0);
    //     expect(signatures.every(signature => typeof signature === 'string')).to.be.true;
    // }

    // describe('getTransaction', () => {
    //     let txid;
    //     beforeEach(async () => {
    //         // txid = await createTransaction(solRpc.connection, senderKeypair, receiverKeypair, 10000n);
    //         txid = await createVersionedTransaction(solRpc.connection, senderKeypair, receiverKeypair, 10000n);
    //     });

    //     it('returns a transaction if provided a valid transaction id', async () => {
    //         // may want to think about this._versionedConfig & its commitment level
    //         const retVal = await solRpc.getTransaction({ txid });
    //         assertValidTransaction(retVal);
    //     })
    // })

    // describe('getTransactions', () => {
    //     /** @type {Keypair} */
    //     let targetKeypair;
    //     beforeEach(async function() {
    //         this.timeout(5e3);
    //         targetKeypair = await createAccount(solRpc.connection, senderKeypair);
    //         for (let i = 0; i < 2; i++) {
    //             await createVersionedTransaction(solRpc.connection, senderKeypair, targetKeypair, 1000 * (i + 1));
    //         }
    //     })

    //     it('returns an array of at most 1000 non-null transactions for a specified address', async () => {
    //         // Consider generating a new address here...
    //         const transactions = await solRpc.getTransactions({ address: targetKeypair.publicKey.toBase58() });
    //         expect(transactions).to.be.an('array');
    //         transactions.forEach(transaction => {
    //             assertValidTransaction(transaction);
    //         });
    //     })
    // }, 5e3);

    // describe('getTransactionCount', () => {
    //     const numTransactions = 2;
    //     /** @type {Keypair} */
    //     let targetKeypair;
    //     beforeEach(async function() {
    //         this.timeout(5e3);
    //         targetKeypair = await createAccount(solRpc.connection, senderKeypair);
    //         for (let i = 0; i < numTransactions; i++) {
    //             await createVersionedTransaction(solRpc.connection, senderKeypair, targetKeypair, 1000 * (i + 1));
    //         }
    //     })

    //     it('returns the count of confirmed transactions for a valid account address', async () => {
    //         const count = await solRpc.getTransactionCount({ address: targetKeypair.publicKey.toBase58() });
    //         expect(count).to.equal(numTransactions + 1); // 1 is the createAccount transaction
    //     }, 5e3)
    // })

    // describe('getRawTransaction', () => {
    //     let txid;
    //     beforeEach(async function () {
    //         this.timeout(3000);
    //         txid = await createVersionedTransaction(solRpc.connection, senderKeypair, receiverKeypair, 10000n);
    //     });
    //     it('returns a base64 encoded string for a valid transaction', async () => {
    //         const txString = await solRpc.getRawTransaction({ txid });
    //         expect(txString).to.be.a('string');
    //         expect(txString).to.equal(Buffer.from(txString, 'base64').toString('base64'));
    //     })
    // })

    // describe('decodeRawTransaction', () => {
    //     it('returns a decoded raw transaction', async () => {
    //         const rawTx = await createRawTransaction(solRpc.connection, senderKeypair, receiverKeypair, 1000);
    //         const decodedRawTransaction = solRpc.decodeRawTransaction({ rawTx })
    //         expect(decodedRawTransaction).to.be.instanceOf(VersionedTransaction);
    //         expect(decodedRawTransaction).to.be.an('object');
    //         expect(decodedRawTransaction).to.have.property('signatures').that.is.an('array');
    //         expect(decodedRawTransaction).to.have.property('message').that.is.an('object');
    //         const { signatures: _, message } = decodedRawTransaction;
    //         expect(message).to.have.property('recentBlockhash').that.is.a('string');
    //         expect(message).to.have.property('accountKeys').that.is.an('array');
    //         expect(message).to.have.property('instructions').that.is.an('array');
    //     })
    // })

    // describe('sendRawTransaction', () => {
    //     it('sends a raw transaction', async () => {
    //         const rawTx = await createRawTransaction(solRpc.connection, senderKeypair, receiverKeypair, 1000);
    //         const signature = await solRpc.sendRawTransaction({ rawTx });
    //         expect(signature).to.be.a('string');
    //     })
    // }) 

    // describe('getBlock', () => {
    //     it('returns a block at provided height', async () => {
    //         const slot = await solRpc.connection.getSlot();
    //         const block = await solRpc.getBlock({ height: slot });
    //         expect(block).to.be.an('object');
    //         expect(block).to.have.property('blockhash').that.is.a('string');
    //         expect(block).to.have.property('blockHeight').that.is.a('number');
    //         expect(block).to.have.property('blockTime').that.is.a('number');
    //         expect(block).to.have.property('parentSlot').that.is.a('number');
    //         expect(block).to.have.property('previousBlockhash').that.is.a('string');
    //         expect(block).to.have.property('rewards').that.is.an('array');
    //         expect(block).to.have.property('transactions').that.is.an('array');
    //     })
    // })

    // describe('getConfirmations', () => {
    //     it('returns the number of confirmations for a valid txid', async function () {
    //         this.timeout(5000);
    //         const confirmedTransactionSignature = await createTransaction(solRpc.connection, senderKeypair, receiverKeypair, 1000);

    //         await new Promise(resolve => setTimeout(resolve, 250));
    //         let confirmations = await solRpc.getConfirmations({ txid: confirmedTransactionSignature });
    //         // Check monotonic increasing number of confirmations over time
    //         for (let i = 0; i < 2; i++) {
    //             await new Promise(resolve => setTimeout(resolve, 500));
    //             const newConfirmations = await solRpc.getConfirmations({ txid: confirmedTransactionSignature });
    //             expect(newConfirmations).to.be.greaterThan(confirmations);
    //             confirmations = newConfirmations;
    //         }
    //     });
    // })

    // describe('getTip', () => {
    //     it('returns the slot number as "height" and the corresponding block at that height', async () => {
    //         const tip = await solRpc.getTip();
    //         expect(tip).to.be.an('object');
    //         expect(tip).to.have.property('hash').that.is.a('string');
    //         expect(tip).to.have.property('height').that.is.a('number');
    //     })
    // })

    // describe('getServerInfo', () => {
    //     it('returns server info', async () => {
    //         const serverInfo = await solRpc.getServerInfo();
    //         expect(serverInfo).to.be.an('object');
    //         expect(serverInfo).to.have.property('feature-set').that.is.a('number');
    //         expect(serverInfo).to.have.property('solana-core').that.is.a('string');
    //     })
    // })

    // describe('isBase58', () => {
    //     it('returns true if a string is valid base58', () => {
    //         const isBase58 = solRpc.isBase58(receiverKeypair.publicKey.toBase58());
    //         expect(isBase58).to.be.true;
    //     })
    //     it('returns false if a string is invalid base58', () => {
    //         const isBase58 = solRpc.isBase58('l1O0');
    //         expect(isBase58).to.be.false;
    //     })
    // })
})

/**
 * 
 * @param {Connection} connection 
 * @param {Keypair} feePayerAndAuthorityKeypair 
 * @param {Keypair} nonceKeypair 
 */
async function createNonceAccount(
    connection,
    feePayerAndAuthorityKeypair,
    nonceKeypair
) {
    try {
        const minimumBalanceForRentExemption = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

        const createAccountInstruction = SystemProgram.createAccount({
            fromPubkey: feePayerAndAuthorityKeypair.publicKey,
            newAccountPubkey: nonceKeypair.publicKey,
            lamports: minimumBalanceForRentExemption,
            space: NONCE_ACCOUNT_LENGTH,
            programId: SystemProgram.programId
        });

        const initNonceInstruction = SystemProgram.nonceInitialize({
            noncePubkey: nonceKeypair.publicKey,
            authorizedPubkey: feePayerAndAuthorityKeypair.publicKey
        });

        const transaction = new Transaction()
            .add(createAccountInstruction)
            .add(initNonceInstruction);

        const signature = await connection.sendTransaction(
            transaction,
            [feePayerAndAuthorityKeypair, nonceKeypair],
            { commitment: 'confirmed' }
        );
        return signature;
    } catch (err) {
        console.error('Error creating nonce account:', err);
        throw err;
    }
}

/**
 * 
 * @param {Connection} connection 
 * @param {Keypair} fromKeypair 
 * @param {Keypair} toKeypair 
 * @param {number} amountInLamports 
 */
async function createVersionedTransaction(connection, fromKeypair, toKeypair, amountInLamports) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create a transfer instruction
    const transferInstruction = SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toKeypair.publicKey,
        lamports: amountInLamports
    });

    // Create a transaction message
    const messageV0 = new TransactionMessage({
        payerKey: fromKeypair.publicKey,
        recentBlockhash: blockhash,
        instructions: [transferInstruction]
    }).compileToV0Message();

    // Create a versioned transaction form the message
    const transaction = new VersionedTransaction(messageV0);

    // Sign
    transaction.sign([fromKeypair]);

    // Send
    const signature = await connection.sendTransaction(transaction);

    // Wait for confirmation
    await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
    }, 'confirmed');

    return signature;
}

/**
 * 
 * @param {Connection} connection 
 * @param {Keypair} fromKeypair 
 * @param {Keypair} toKeypair 
 * @param {number} amountInLamports 
 */
async function createTransaction(connection, fromKeypair, toKeypair, amountInLamports) {
    const transaction = await createUnsignedTransaction(connection, fromKeypair, toKeypair, amountInLamports);
    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair], { commitment: 'confirmed' });
    return signature;
}

/**
 * 
 * @param {import("@solana/web3.js").Rpc} rpc 
 * @param {import("@solana/web3.js").KeyPairSigner} fromKeypair 
 * @param {import("@solana/web3.js").KeyPairSigner} toKeypair 
 * @param {number} amountInLamports 
 */
async function createRawTransaction(
    rpc,
    fromKeypair,
    toKeypair,
    amountInLamports
) {
    const transaction = await createUnsignedTransaction(rpc, fromKeypair, toKeypair, amountInLamports);
    const signedTransaction = await signTransactionMessageWithSigners(transaction);
    const base64EncodedTransaction = getBase64EncodedWireTransaction(signedTransaction);
    return base64EncodedTransaction;
}

/**
 * 
 * @param {import("@solana/web3.js").Rpc} rpc 
 * @param {import("@solana/web3.js").KeyPairSigner} fromKeypair 
 * @param {import("@solana/web3.js").KeyPairSigner} toKeypair 
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

    const transferInstruction = getTransferSolInstruction({
        amount: amountInLamports,
        destination: toKeypair.address,
        source: fromKeypair
    });

    const transactionMessage = pipe(
        createTransactionMessage({ version }),
        (tx) => setTransactionMessageFeePayerSigner(fromKeypair, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
        (tx) => appendTransactionMessageInstructions([transferInstruction], tx)
    );

    return transactionMessage;
}

async function createAccount(
    connection,
    feePayerKeypair
) {
    const keypair = Keypair.generate();
    const space = 0;
    const rentLamports = await connection.getMinimumBalanceForRentExemption(space);
    const createAccountTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: feePayerKeypair.publicKey,
            newAccountPubkey: keypair.publicKey,
            lamports: rentLamports,
            space,
            programId: SystemProgram.programId
        })
    )
    await sendAndConfirmTransaction(connection, createAccountTransaction, [feePayerKeypair, keypair]);
    return keypair;
}