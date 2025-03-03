const {
  address,
  createSolanaRpc,
  generateKeyPair,
  isAddress,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  getAddressFromPublicKey,
  signTransaction,
  getComputeUnitEstimateForTransactionMessageFactory,
  getTransactionDecoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  getSignersFromTransactionMessage,
  prependTransactionMessageInstructions,
  sendAndConfirmTransactionFactory,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  appendTransactionMessageInstruction,
  compileTransactionMessage,
  getCompiledTransactionMessageEncoder,
  getBase64Decoder,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingDurableNonce,
  sendAndConfirmDurableNonceTransactionFactory,
  createKeyPairSignerFromPrivateKeyBytes,
} = require('@solana/web3.js');
const {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} = require('@solana-program/compute-budget');
const { getTransferSolInstruction, getAdvanceNonceAccountInstruction } = require('@solana-program/system');

const { pipe } = require('@solana/functional');
const EventEmitter = require('events');
const bs58 = require('bs58');

// TEMP
const ERRORS = {
  NOT_IMPLEMENTED: 'Not implemented'
}

// Proxies
const NONCE_ACCOUNT_LENGTH = 0;

class SolRPC {

/**
 * Constructs a new instance of the SolRPC class.
 * 
 * @param {Object} config - The configuration object containing the connection details.
 * @param {string} config.protocol - The network protocol (e.g., 'http', 'https', 'wss').
 * @param {string} config.host - The host URL or IP address.
 * @param {number} [config.port] - The port number (optional).
 * @param {string} config.account - The account to use for transactions.
 */
constructor(config) {
  this.config = config;
  this.rpc = this.initRpcConnection(this.config);
  this.rpcSubscriptions = this.initRpcSubscriptions(this.config);
  this.emitter = new EventEmitter();
  // configuration for retrieving versioned blocks and transactions
  this._versionedConfig = {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0
  };

  // proxy stuff
  this.wsUrl = 'ws://localhost:5005';
}

/**
 * Creates and returns a new Web3 Connection instance configured with the specified connection settings.
 * The connection is set to return data that has been confirmed by the cluster.
 * 
 * @param {Object} connectionConfig - The configuration object containing the connection details.
 * @param {string} connectionConfig.protocol - The network protocol (e.g., 'http', 'https', 'wss').
 * @param {string} connectionConfig.host - The host URL or IP address.
 * @param {number} [connectionConfig.port] - The port number (optional).
 * @throws {Error} If the protocol is not specified or is invalid.
 * @returns {import('@solana/web3.js').Rpc<import('@solana/web3.js').SolanaRpcApi>}
 * @DONE
 */
initRpcConnection(connectionConfig) {
  const { protocol, host, port } = connectionConfig;
  if (!protocol || !['wss', 'http', 'https'].includes(protocol.toLowerCase())) {
    throw new Error('Please provide a valid protocol');
  }
  const connectionString = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
  const rpc = createSolanaRpc(connectionString);
  return rpc;
}

/** @DONE */
initRpcSubscriptions(connectionConfig) {
  return createSolanaRpcSubscriptions(this.wsUrl);
}

/** @TODO */
async executeRpcRequest() {
  throw new Error(ERRORS.NOT_IMPLEMENTED);
}

/** @TODO */
async executeSubscription() {
  throw new Error(ERRORS.NOT_IMPLEMENTED);
}

/** DONE */
getConnection() {
  return this.rpc;
}

/**
 * Retrieves the balance of the specified address.
 * 
 * @param {Object} params - The parameters for retrieving the balance.
 * @param {string} params.address - The public key of the address to check the balance for.
 * @returns {Promise<import('@solana/web3.js').Lamports|null>} The balance of the specified address in lamports.
 * @DONE
 */
async getBalance({ address }) {
  if (!this.validateAddress({ address })) {
    return null;
  }
  const { value: lamports } = await this.rpc.getBalance(this.toAddress(address)).send();
  return lamports;
}

/**
 * Sends a specified amount of lamports to a given address, either through a versioned or legacy transaction.
 * 
 * @param {Object} params - The parameters for the transaction.
 * @param {string} params.address - The public key of the recipient.
 * @param {number} params.amount - The amount of lamports to send.
 * @param {import('@solana/web3.js').KeyPairSigner<string>} params.fromAccountKeypair - The keypair of the sender - use a web3.js `createKeyPairSignerFromPrivateBytes` method.
 * @param {import('@solana/web3.js').KeyPairSigner<string>} [params.feePayerKeypair] - The keypair of the transaction fee payer - if not included, fromAccountKeypair
 * @param {string} [params.nonceAddress] - The public key of the nonce account
 * @param {string} [params.nonceAuthorityAddress] - The public key of the nonce account's authority - if not included, nonceAddress
 * @param {'legacy' | 0} [params.txType='legacy'] - The type of transaction ('legacy' or '0' for versioned).
 * @param {boolean} [params.priority=false] - Whether to add a priority fee to the transaction.
 * @returns {Promise<string>} The transaction hash.
 * @throws {Error} If the transaction confirmation returns an error.
 * @TODO largely done
 */
async sendToAddress({ 
  address: addressStr,
  amount,
  fromAccountKeypair: fromAccountKeypairSigner,
  feePayerKeypair: feePayerKeypairSigner,
  nonceAddress: nonceAddressStr,
  nonceAuthorityAddress: nonceAuthorityAddressStr,
  txType: version = 'legacy',
  priority
}) {
  try {
    if (!(fromAccountKeypairSigner instanceof CryptoKeyPair)) {
      throw new Error('Invalid Solana Keypair object');
    }

    const VALID_TX_VERSIONS = ['legacy', 0];
    if (!VALID_TX_VERSIONS.includes(txType)) {
      throw new Error('Invalid transaction version');
    }

    const fromAccountAddress = fromAccountKeypairSigner.address;
    const destinationAddress = this.toAddress(addressStr);

    let transaction;

    let transactionMessageOLD = pipe(
      createTransactionMessage({ version }),
      tx => setTransactionMessageFeePayerSigner(feePayerKeypairSigner || fromAccountKeypairSigner, tx), 
      lifetimeSetter,
      tx => appendTransactionMessageInstructions([
          getSetComputeUnitPriceInstruction({ microLamports: 5000n }),
          getTransferSolInstruction({
              amount, // @TODO look at this
              destination: destinationAddress,
              source: fromAccountAddress
          }),
      ], tx)
    );

    // Create transaction message and add fee payer signer
    let transactionMessage = pipe(
      createTransactionMessage({ version }),
      tx => setTransactionMessageFeePayerSigner(feePayerKeypairSigner || fromAccountKeypairSigner, tx),
    );

    // Async message component may not be put in pipe
    transactionMessage = await this.#setTransactionMessageLifetime({ transactionMessage });

    // will this work -= does it mutate?
    transactionMessage = appendTransactionMessageInstructions([
      getSetComputeUnitPriceInstruction({ microLamports: 5000n }),
      getTransferSolInstruction({
          amount, // @TODO look at this
          destination: destinationAddress,
          source: fromAccountAddress
      }),
    ], transactionMessage);

    if (priority) {
      transactionMessageOLD = await this.addPriorityFee({ transaction: transactionMessageOLD })
    }

    const sendParams = [transactionMessageOLD, { maxRetries: 5 }];
    // if (txType === 'legacy') {
    //   sendParams.splice(1, 0, [fromAccountKeypair]);
    // }

    const txid = await this.connection.sendTransaction(...sendParams);
    return txid;
  } catch (err) {
    this.emitter.emit(`Failure sending a type ${txType} transaction to address ${address}`, err);
    throw err;
  }
}

/**
 * @param {Object} input
 * @param {string} [input.nonceAddressStr]
 * @param {string} [input.nonceAuthorityAddressStr]
 * @param {import('@solana/web3.js').ITransactionMessageWithFeePayerSigner<any>} input.transactionMessage
 */
async #setTransactionMessageLifetime({ nonceAddressStr, nonceAuthorityAddressStr, transactionMessage }) {
  let transactionMessageWithLifetime;
  if (nonceAddressStr) {
    const nonceAccountAddress = address(nonceAddressStr);
    const nonceAuthorityAddress = address(nonceAuthorityAddressStr);
    const nonce = await this.#getNonce(nonceAccountAddress);
    (tx) => setTransactionMessageLifetimeUsingDurableNonce({
      nonce,
      nonceAccountAddress,
      nonceAuthorityAddress
    }, tx)
    transactionMessageWithLifetime = setTransactionMessageLifetimeUsingDurableNonce({
      nonce,
      nonceAccountAddress,
      nonceAuthorityAddress
    }, transactionMessage);
  } else {
    const { hash: blockhash, lastValidBlockHeight } = await this.getTip();
    if (!blockhash) {
      throw new Error('Latest blockhash could not be retrieved');
    }
    transactionMessageWithLifetime = setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, transactionMessage);
  }
  return transactionMessageWithLifetime;
}

/**
 * 
 * @param {import('@solana/web3.js').Address<string>} nonceAddress
 * @returns {Promise<import('@solana/web3.js').Nonce<string>>}
 */
async #getNonce(nonceAddress) {
  const NONCE_VALUE_OFFSET = 4 + 4 + 32;
  const { value: nonceAccountInfo } = await this.rpc
  .getAccountInfo(nonceAddress, {
    dataSlice: { offset: NONCE_VALUE_OFFSET, length: 32 },
    encoding: 'base58',
  })
  .send();

  // nonceAccountInfo.data[0] will be empty string if provided account is not 
  if (!nonceAccountInfo?.data || !nonceAccountInfo.data[0]) {
    throw new Error('Failed to read the new nonce from the account');
  }

  /** @type {string} */
  const base58Nonce = nonceAccountInfo.data[0];
  /** @type {import('@solana/web3.js').Nonce<string>} */
  const nonce = base58Nonce;
  return nonce;
}



/**
 * 
 * @param {Object} params
 * @param {import("@solana/web3.js").Address<string>} params.destinationAddressddress - destination
 * @param {number} params.amount - The amount of lamports to send.
 * @param {CryptoKey} params.fromAccountPublicKey
 * @param {import("@solana/web3.js").Blockhash} params.blockhash
 * @param {string} params.nonceAddressStr
 * @param {0 | 'legacy'} [params.version='legacy'] 
 * @REVIEW
 */
async #createTransferTransactionMessage({ destinationAddress, amount, fromAccountPublicKey, blockhash, nonceAddressStr, version = 'legacy' }) {
  let recentBlockhash = blockhash; // @TODO conditionally update with nonce

  // new implementation
  const signer = await generateKeyPair();
  signer.publicKey

  const { blockhash: latestBlockhash } = await this.#getLatestBlockhash();
  const transactionMessage = createTransactionMessage({ version });

  // Set the fee payer
  const feePayer = await getAddressFromPublicKey(fromAccountPublicKey);
  const transactionMessageWithFeePayer = setTransactionMessageFeePayer(feePayer, transactionMessage);

  // 

  // old implementation
  let recentBlockhash = block.hash;
  /** @TODO */
  if (nonceAddress) {
    const nonceAccount = new Web3.PublicKey(nonceAddress);
    const nonceAccountInfo = await this.rpc.getNonce(nonceAccount);
    recentBlockhash = nonceAccountInfo.nonce;
  }
  const instructions = [
    Web3.SystemProgram.transfer({
      fromPubkey: fromAccount,
      toPubkey: address,
      lamports: BigInt(amount)
    })
  ];
  const message = new Web3.TransactionMessage({
    payerKey: fromAccount,
    recentBlockhash,
    instructions
  }).compileToV0Message();
  return new Web3.VersionedTransaction(message);
}

/** @TODO */
async createNonceAccount(senderKeypair, nonceAccountKeypair) {
  if (!(senderKeypair instanceof Web3.Keypair)) {
    throw new Error('Invalid Solana Keypair: Sender');
  }
  if (!(nonceAccountKeypair instanceof Web3.Keypair)) {
    throw new Error('Invalid Solana Keypair: Nonce Account ');
  }
  const { blockhash, lastValidBlockHeight } = await this.#getLatestBlockhash();
  const minimumRent = await this.connection.getMinimumBalanceForRentExemption(Web3.NONCE_ACCOUNT_LENGTH);
  const nonceAccountTransaction = new Web3.Transaction({
    feePayer: senderKeypair.publicKey,
    recentBlockhash: blockhash,
    lastValidBlockHeight
  }).add(
    Web3.SystemProgram.createAccount({
      fromPubkey: senderKeypair.publicKey,
      newAccountPubkey: nonceAccountKeypair.publicKey,
      lamports: minimumRent,
      space: Web3.NONCE_ACCOUNT_LENGTH,
      programId: Web3.SystemProgram.programId,
    }),
    Web3.SystemProgram.nonceInitialize({
      noncePubkey: nonceAccountKeypair.publicKey,
      authorizedPubkey: senderKeypair.publicKey,
    })
  );
  try {
    return await Web3.sendAndConfirmTransaction(this.connection, nonceAccountTransaction, [senderKeypair, nonceAccountKeypair]);
  } catch (err) {
    this.emitter.emit('Failure to create a nonce account', err);
    throw err;
  }
}

/**
 * Estimates the transaction fee either based on a raw transaction or by calculating the average fee
 * over a specified number of blocks.
 * 
 * @param {Object} options - The options for fee estimation.
 * @param {number} [options.nBlocks=10] - The number of recent blocks to consider for average fee calculation.
 * @param {string} [options.rawTx] - The raw transaction data for direct fee estimation.
 * @returns {Promise<number>} The estimated fee in lamports.
 * @throws Will throw an error on raw tx estimation if the fee estimation fails or tx cannot be decoded.
 * @DONE
 */
async estimateFee({ nBlocks = 10, rawTx }) {
  if (!rawTx) {
      throw new Error('rawTx required');
  }

  if (rawTx) {
    // Recommended. Directly estimate fee based on the provided raw transaction size.
    return await this.estimateTransactionFee({ rawTx });
  }

  // // Fee can be a calculated by (Number of Signatures × Lamports per Signature)
  // // Calculate the average lamports per signature over the past n blocks
  // const samples = (await this.rpc.getRecentPerformanceSamples(nBlocks).send()).values();
  
  // let totalFees = 0;
  // let totalBlocks = 0;
  // const minFee = 5000; // Set a minimum fee per signature in lamports
  // for (const sample of samples) {
  //   const block = await this.getBlock({ height: sample.slot });
  //   if (!block) {
  //     continue;
  //   }
  //   const { blockhash } = block;
  //   if (blockhash) {
  //     const feeCalculator = await this.rpc.getFeeCalculatorForBlockhash()
  //     // const feeCalculator = await this.connection.getFeeCalculatorForBlockhash(blockhash, 'confirmed');
      
  //     if (feeCalculator && feeCalculator.value) {
  //       totalFees += feeCalculator.value.lamportsPerSignature;
  //       totalBlocks++;
  //     }
  //   }
  // }
  // // Return the average fee or the minimum fee if no blocks were processed
  // return totalBlocks > 0 ? (totalFees / totalBlocks) : minFee;
}

/**
 * Estimates the transaction fee based on the provided raw transaction data.
 * 
 * @param {Object} options - The options for fee estimation.
 * @param {string} options.rawTx - The raw transaction data for direct fee estimation.
 * @returns {Promise<number>} The estimated fee in lamports.
 * @throws Will throw an error if the fee estimation fails or tx cannot be decoded.
 * @DONE
 */
async estimateTransactionFee({ rawTx }) {
  const tx = this.decodeRawTransaction({ rawTx });
  if (!tx) {
    throw new Error('Could not decode provided raw transaction');
  }

  const base64EncodedMessage = this.#solTxMsgToBase64Msg(tx.messageBytes);
  const { value } = (await this.rpc.getFeeForMessage(base64EncodedMessage).send());

  if (value === null) {
      throw new Error('Failed to estimate transaction fee');
  }

  return value;
}

/**
 * Estimates the maximum priority fee based on recent transaction fees and a specified percentile.
 * This function retrieves recent prioritization fees and calculates the fee at the given percentile.
 * The fee is the per-compute-unit fee paid by at least one successfully landed transaction
 * 
 * @param {Object} config - Configuration options for retrieving prioritization fees.
 * @param {number} [percentile=25] - The percentile (0-100) of fees to consider for maximum priority fee estimation.
 * @returns {Promise<number|null>} The estimated maximum priority fee or null if no fees are available.
 * @DONE
 */
async estimateMaxPriorityFee({ config, percentile = 25 }) {
  const recentFees = await this.rpc.getRecentPrioritizationFees(config).send();
  if (!recentFees || recentFees.length === 0) {
    return null;
  }

  const priorityFees = recentFees
    .filter(recentFee => Number(recentFee.prioritizationFee) > 0)
    .map(recentFee => recentFee.prioritizationFee)

  if (!priorityFees || priorityFees.length === 0) {
      return 0;
  }
  
  const sortedPriorityFees = priorityFees.sort((a, b) => a - b);
  const feeIdx = Math.floor(sortedPriorityFees.length * (percentile / 100)) - Math.floor(percentile / 100);
  return sortedPriorityFees[feeIdx];
}

/**
 * Adds a priority fee to the given transaction based on recent prioritization fees.
 * This function modifies the compute unit limit and sets the compute unit price for the transaction.
 * 
 * @param {Object} params - Parameters for adding priority fee.
 * @param {any} params.transaction - The transaction to which the priority fee will be added.
 * @param {number} [params.unitLimit=300] - The compute unit limit to set for the transaction.
 * @param {Object} params.config - Configuration options for retrieving prioritization fees.
 * @returns {Promise<Web3.VersionedTransaction>} The modified transaction with the added priority fee.
 * @throws Will throw an error if adding the priority fee fails for reasons other than 'Method not found'.
 * @DONE mostly - see TODO
 */
async addPriorityFee({ transaction, unitLimit = 300, config }) {
  try {
    const priorityFee = await this.estimateMaxPriorityFee({ config });
    if (priorityFee == null) {
      throw new Error('Unexpected null priority fee');
    }

    const estimatedComputeUnits = await this.#getComputeUnitEstimate(transaction);
    const budgetedTransactionMessage = prependTransactionMessageInstructions(
      [
          getSetComputeUnitLimitInstruction({ units: estimatedComputeUnits }), /** @TODO consider unitLimit */
          getSetComputeUnitPriceInstruction({ microLamports: priorityFee })
      ]
    );

    return budgetedTransactionMessage;
  } catch (err) {
      /** @TODO throw */
    if (err && err.message !== 'failed to get recent prioritization fees: Method not found') {
      this.emitter.emit('failure', err);
      throw err;
    }
    console.warn('Priority fee\'s are not supported by this cluster', err);
    throw err;
  }
}

/** @DONE with inner TODO to consider buffering compute units */
async #getComputeUnitEstimate({ transactionMessage }) {
  const getComputeUnitEstimate = getComputeUnitEstimateForTransactionMessageFactory({ rpc: this.rpc });
  const estimatedComputeUnits = await getComputeUnitEstimate(transactionMessage);
  /** @TODO a buffer would be appropriate here - like scaling (1.1x) or addition (x + 1000) */
  return estimatedComputeUnits;
}

/**
 * Retrieves the hash of the best block (tip) in the blockchain.
 * This function fetches the tip of the blockchain and returns its hash.
 * 
 * @returns {Promise<string|null>} The hash of the best block or null if the tip is not available.
 * @DONE
 */
async getBestBlockHash() {
  const tip = await this.getTip();
  if (!tip) {
    return null;
  }
  return tip.hash;
}

/**
 * Retrieves a transaction by its transaction ID.
 * 
 * @param {Object} params - Parameters for retrieving the transaction.
 * @param {string} params.txid - The transaction ID of the transaction to retrieve.
 * @DONE
 */
async getTransaction({ txid, config }) {
  if (!txid || !this.isBase58(txid)) {
    return null;
  }
  const tx = await this.rpc.getTransaction(txid, config || this._versionedConfig).send();
  return tx;
}

/**
 * Get all transactions for an account
 * @param {Object} params - Parameters for retrieving transactions.
 * @param {string} params.address - Account address to get transactions for.
 * @DONE
 */
async getTransactions({ address: addressStr }) {
  if (!this.validateAddress({ address: addressStr })) {
    return null;
  }

  const signatureObjects = await this.#getSignaturesForAddress(addressStr);
  const txids = signatureObjects.map(signatureObject => signatureObject.signature);
  const transactions = [];

  // Fetch transaction details for each signature
  for (const txid of txids) {
    try {
      const tx = await this.getTransaction(txid);
      if (tx) {
        transactions.push(tx);
      }
    } catch (err) {
      this.emitter.emit('failure', err);
    }
  }
  return transactions;
}

/**
 * Retrieves the count of confirmed transactions for a given account address.
 * Note: Returned data is affected by the nodes retention period. Non-archival nodes will not return full count.
 * 
 * @param {Object} params - Parameters for retrieving the transaction count.
 * @param {string} params.address - The account address to get the transaction count for.
 * @returns {Promise<number|null>} A promise that resolves to the number of confirmed transactions.
 * @DONE
 */
async getTransactionCount({ addressStr }) {
  if (!this.validateAddress({ address: addressStr })) {
    return null;
  }
  let signatures = await this.#getSignaturesForAddress(addressStr);
  let result = signatures.length;
  while (signatures.length === 1000) {
    const beforeSignature = signatures[signatures.length - 1].signature;
    const nextBatch = await this.#getSignaturesForAddress(key, { before: beforeSignature });
    signatures = nextBatch;
    result += signatures.length;
  }

  return result;
}

/**
 * Retrieves signatures in reverse chronological order
 * @param {string} addressStr
 * @param {Object} [config]
 * @param {import("@solana/web3.js").Signature} [config.before]
 * @param {'confirmed' | 'finalized'} [config.commitment='finalized']
 * @param {number} [config.limit=1000]
 * @param {import("@solana/web3.js").Slot} [config.minContextSlot]
 * @param {import("@solana/web3.js").Signature} [config.until]
 * 
 * @DONE
 */
async #getSignaturesForAddress(addressStr, config) {
  const address = this.toAddress(addressStr);
  return await this.rpc.getSignaturesForAddress(address, config).send();
}

/**
 * Retrieves and serializes a raw transaction by its transaction ID.
 * 
 * @param {Object} params - Parameters for retrieving the raw transaction.
 * @param {string} params.txid - The transaction ID of the transaction to retrieve.
 * @returns {Promise<string|null>} A promise that resolves to the raw transaction as a base64 string or null if not found.
 * @COMEBACK
 */
async getRawTransaction({ txid }) {
  if (!txid || !this.isBase58(txid)) {
    return null;
  }
  const tx = await this.getTransaction(txid);
  if (!tx?.transaction?.signatures) {
    return null;
  }
  const signatures = tx.transaction.signatures.map(sig => bs58.decode(sig));
  const vTx = new Web3.VersionedTransaction(tx.transaction.message, signatures);
  return this.toBuffer(vTx.serialize()).toString('base64');
}

/**
 * Decodes a raw transaction.
 * 
 * @param {Object} params - Parameters for decoding the raw transaction.
 * @param {Uint8Array|string} params.rawTx - The raw transaction to be decoded.
 * @returns {{ messageBytes: import('@solana/web3.js').TransactionMessageBytes; signatures: import('@solana/web3.js').SignaturesMap } | null} The decoded transaction or null if the input is invalid.
 * @DONE
 */
decodeRawTransaction({ rawTx }) {
  if (rawTx && typeof rawTx === 'string') {
    rawTx = this.base64ToUint8Array(rawTx);
  }
  if (!(rawTx instanceof Uint8Array)) {
    return null;
  }

  const transactionDecoder = getTransactionDecoder();
  const decodedTransaction = transactionDecoder.decode(rawTx);
  return decodedTransaction;
}

/**
 * Sends a raw transaction to the network.
 * 
 * @param {Object} params - Parameters for sending the raw transaction.
 * @param {Uint8Array} params.rawTx - The raw transaction to be sent.
 * @returns {Promise<string|null>} A promise that resolves to the transaction ID or null if the transaction is invalid.
 * @TODO
 */
async sendRawTransaction({ rawTx }) {
  const transaction = this.decodeRawTransaction({ rawTx });
  if (!transaction) {
    return null;
  }
  return await this.connection.sendRawTransaction(transaction.serialize());
}

/**
 * Retrieves a block by its height or hash.
 * 
 * @param {Object} params - Parameters for retrieving the block.
 * @param {string} [params.hash] - The hash of the block to retrieve.
 * @param {number} [params.height] - The height of the block to retrieve.
 * @returns {Promise<Block | null>} A promise that resolves to the block object or null if not found.
 * @throws {Error} If hash is provided instead of height.
 * @DONE
 */
async getBlock({ hash, height }) {
  if (!Number.isInteger(height)) {
      return null;
  }
  if (hash) {
    throw new Error('Hash is not supported. Provide a height instead');
  }
  const block = await this.rpc.getBlock(height, this._versionedConfig).send();
  return block;
}

/**
 * Get the number of confirmations for a given transaction ID.
 * 
 * @param {Object} params - The parameters for the function.
 * @param {string} params.txid - The transaction ID to get confirmations for.
 * @returns {Promise<number|null>} - The number of confirmations or null if not available.
 * @TODO
 */
async getConfirmations({ txid }) {
  if (!txid || !this.isBase58(txid)) {
    return null;
  }
  const status = await this.connection.getSignatureStatus(txid);
  if (status && status.value && status.value.confirmations) {
    return status.value.confirmations;
  }
  const latestSlot = await this.connection.getSlot({ commitment: 'confirmed' });
  if (status && status.value && latestSlot) {
    return latestSlot - status.value.slot;
  }
  const tx = await this.connection.getTransaction(txid, this._versionedConfig);
  if (latestSlot && tx && tx.slot) {
    return latestSlot - tx.slot;
  }
  return null;
}

/**
 * Get the current tip of the blockchain.
 * Solana slot is synonymous with a blockchains height.
 * @returns {Promise<{ height: bigint; hash: import("@solana/web3.js").Blockhash | null }>} - An object containing the height (slot) and hash of the current block.
 * @DONE
 */
async getTip() {
  const slot = await this.rpc.getSlot({ commitment: 'confirmed' }).send();
  const block = await this.getBlock({ height: slot });
  return { height: slot, hash: block?.blockhash ?? null };
}

/** @DONE */
getTxOutputInfo() {
  return null;
}

/**
 * Validates a given address.
 * 
 * @param {Object} params - The parameters for the function.
 * @param {string} params.address - The address to validate.
 * @returns {boolean} - Returns true if the address is  on , otherwise false.
 * @DONE
 */
validateAddress({ address }) {
  try {
    return isAddress(address);
  } catch (error) {
    return false;
  }
}

/** @DONE */
getAccountInfo() {
  return {};
}

/**
 * Retrieves the version information from the Solana node.
 * @DONE
 */
async getServerInfo() {
  return await this.rpc.getVersion().send();
}

/**
 * Checks if the given address is a valid Solana address.
 * 
 * @param {string} address - The address to validate.
 * @returns {boolean} True if the address is valid, false otherwise.
 * @DONE
 */
isValidAddress(address) {
  try {
    this.toAddress(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Checks if the given string is a valid Base58 encoded string.
 * 
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is valid Base58, false otherwise.
 * @DONE no change
 */
isBase58(str) {
  try {
    bs58.decode(str);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Converts the given address to a Solana Web3 PublicKey instance.
 * 
 * @param {string} addressStr - The address to convert.
 * @returns {import("@solana/web3.js").Address<string>} The converted Web3 PublicKey instance.
 * @DONE
 */
toAddress(addressStr) {
  return address(addressStr);
}

/**
 * Converts the given input to a Buffer instance.
 * 
 * @param {Array|Uint8Array|Buffer} arr - The input to convert.
 * @returns {Buffer} The converted Buffer instance.
 * @DONE no change
 */
toBuffer(arr) {
  if (Buffer.isBuffer(arr)) {
    return arr;
  } else if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  } else {
    return Buffer.from(arr);
  }
}

/**
 * Converts a base64 encoded string to a Uint8Array.
 * 
 * @param {string} str - The base64 encoded string to convert.
 * @returns {Uint8Array} The converted Uint8Array.
 * @DONE no change
 */
base64ToUint8Array(str) {
  // Decode the base64 string to a Buffer
  const buffer = Buffer.from(str, 'base64');
  // Convert the Buffer to a Uint8Array
  const uint8Array = new Uint8Array(buffer);
  return uint8Array;
}

/**
 * Converts a Uint8Array to a base64 encoded string.
 * 
 * @param {Array} arr - The Uint8Array to convert.
 * @returns {string} The converted base64 encoded string .
 * @DONE no change
 */
uint8ArrayToBase64(arr) {
  return this.toBuffer(arr).toString('base64');
}

// ADD ONS
async #getLatestBlockhash() {
  const { value } = (await this.rpc.getLatestBlockhash().send());
  return value
}

/**
 * 
 * @param {import("@solana/web3.js").TransactionMessageBytes} messageBytes 
 */
async #solTxMsgToBase64Msg(messageBytes) {
  const base64EncodedMessage = pipe(
      messageBytes,
      compileTransactionMessage,
      getCompiledTransactionMessageEncoder().encode,
      getBase64Decoder().decode
  );

  return base64EncodedMessage;
}
}
module.exports = SolRPC;

/**
* @typedef {Object} Block
* @property {bigint} blockHeight
* @property {import("@solana/web3.js").UnixTimestamp} blockTime
* @property {import("@solana/web3.js").Blockhash} blockhash
* @property {import("@solana/web3.js").Slot} parentSlot
* @property {import("@solana/web3.js").Blockhash} previousBlockhash
*/