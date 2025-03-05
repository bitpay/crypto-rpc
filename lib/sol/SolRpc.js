const {
  address,
  createSolanaRpc,
  isAddress,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  getComputeUnitEstimateForTransactionMessageFactory,
  getTransactionDecoder,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  createSolanaRpcSubscriptions,
  setTransactionMessageFeePayerSigner,
  appendTransactionMessageInstructions,
  appendTransactionMessageInstruction,
  compileTransactionMessage,
  getCompiledTransactionMessageEncoder,
  getBase64Decoder,
  setTransactionMessageLifetimeUsingDurableNonce,
  sendAndConfirmDurableNonceTransactionFactory,
  signTransactionMessageWithSigners,
  prependTransactionMessageInstruction,
  signature,
} = require('@solana/web3.js');
const {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} = require('@solana-program/compute-budget');
const { getTransferSolInstruction, getCreateAccountInstruction, SYSTEM_PROGRAM_ADDRESS, getInitializeNonceAccountInstruction } = require('@solana-program/system');

const { pipe } = require('@solana/functional');
const EventEmitter = require('events');
const bs58 = require('bs58');

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
  initRpcSubscriptions() {
    return createSolanaRpcSubscriptions(this.wsUrl);
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
 * @DONE
 */
  async sendToAddress({ 
    address: addressStr,
    amount,
    fromAccountKeypair: fromAccountKeypairSigner,
    feePayerKeypair: feePayerKeypairSigner,
    nonceAddress: nonceAddressStr,
    txType: version = 'legacy',
    priority
  }) {
    try {
      const VALID_TX_VERSIONS = ['legacy', 0];
      if (!VALID_TX_VERSIONS.includes(version)) {
        throw new Error('Invalid transaction version');
      }

      const fromAccountAddress = fromAccountKeypairSigner.address;
      const destinationAddress = this.toAddress(addressStr);

      // Create transaction message and add fee payer signer
      let transactionMessage = pipe(
        createTransactionMessage({ version }),
        tx => setTransactionMessageFeePayerSigner(feePayerKeypairSigner || fromAccountKeypairSigner, tx),
      );

      // Async message component may not be put in pipe
      transactionMessage = await this.#setTransactionMessageLifetime({ transactionMessage });

      if (priority) {
        transactionMessage = await this.addPriorityFee({ transactionMessage });
      }

      transactionMessage = appendTransactionMessageInstructions([
        getTransferSolInstruction({
          amount,
          destination: destinationAddress,
          source: fromAccountAddress
        }),
      ], transactionMessage);

      transactionMessage = await this.#prependComputeUnitLimitInstruction(transactionMessage);
      const signedTransactionMessage = await signTransactionMessageWithSigners(transactionMessage);

      if (nonceAddressStr) {
        const sendAndConfirmNonceTransaction = sendAndConfirmDurableNonceTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
        await sendAndConfirmNonceTransaction(signedTransactionMessage, { commitment: 'confirmed' });
      } else {
        const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
        await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
      }
      const txid = getSignatureFromTransaction(signedTransactionMessage);
      return txid;
    } catch (err) {
      this.emitter.emit(`Failure sending a type ${version} transaction to address ${address}`, err);
      throw err;
    }
  }

  /**
 * @param {Object} input
 * @param {string} [input.nonceAddressStr]
 * @param {string} [input.nonceAuthorityAddressStr]
 * @param {import('@solana/web3.js').ITransactionMessageWithFeePayerSigner<any>} input.transactionMessage
 * @DONE
 */
  async #setTransactionMessageLifetime({ nonceAddressStr, nonceAuthorityAddressStr, transactionMessage }) {
    let transactionMessageWithLifetime;
    if (nonceAddressStr) {
      const nonceAccountAddress = address(nonceAddressStr);
      const nonceAuthorityAddress = address(nonceAuthorityAddressStr);
      const nonce = await this.#getNonce(nonceAccountAddress);
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
 * @DONE
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
   * @DONE
   */
  async #prependComputeUnitLimitInstruction(transactionMessage) {
    const getComputeUnitEstimate = getComputeUnitEstimateForTransactionMessageFactory({ rpc: this.rpc });
    const estimatedComputeUnits = await getComputeUnitEstimate(transactionMessage);
    const transactionMessageWithComputeUnitLimit = prependTransactionMessageInstruction(
      getSetComputeUnitLimitInstruction({ units: estimatedComputeUnits }),
      transactionMessage
    );
    return transactionMessageWithComputeUnitLimit;
  }

  /**
   * 
   * @param {import('@solana/web3.js').KeyPairSigner<string>} payerAndAuthority
   * @param {import('@solana/web3.js').KeyPairSigner<string>} nonceAccount
   * @returns 
   * @DONE
   */
  async createNonceAccount(payerAndAuthority, nonceAccount) {
    try {
      // Get the min balance for rent exception
      // const space = 80n;
      // const lamportsForRent = await this.rpc.getMinimumBalanceForRentExemption(space).send();

      // Build the tx
      // const createAccountInstruction = getCreateAccountInstruction({
      //   payer: payerAndAuthority,
      //   newAccount: nonceAccount,
      //   lamports: lamportsForRent,
      //   space,
      //   programAddress: SYSTEM_PROGRAM_ADDRESS
      // });

      const initializeNonceAccountInstruction = getInitializeNonceAccountInstruction(
        {
          nonceAccount: nonceAccount.address,
          nonceAuthority: payerAndAuthority.address
        }
      );

      const latestBlockhash = await this.#getLatestBlockhash();
      const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(payerAndAuthority, tx), // fix payer
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(
          // [createAccountInstruction, initializeNonceAccountInstruction],
          [initializeNonceAccountInstruction],
          tx
        )
      );

      // Sign & send
      const signedTransactionMessage = await signTransactionMessageWithSigners(transactionMessage);

      const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
      await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
      return getSignatureFromTransaction(signedTransactionMessage);
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
  async estimateFee({ rawTx }) {
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
      .map(recentFee => recentFee.prioritizationFee);

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
 * @param {any} params.transactionMessage - The transaction to which the priority fee will be added.
 * @param {number} [params.unitLimit=300] - The compute unit limit to set for the transaction. - unused
 * @param {Object} params.config - Configuration options for retrieving prioritization fees.
 * @throws Will throw an error if adding the priority fee fails for reasons other than 'Method not found'.
 * @DONE
 */
  async addPriorityFee({ transactionMessage, config }) {
    try {
      const priorityFee = await this.estimateMaxPriorityFee({ config });
      if (priorityFee == null) {
        throw new Error('Unexpected null priority fee');
      }

      const transactionWithPriorityFee = appendTransactionMessageInstruction(
        getSetComputeUnitPriceInstruction({ microLamports: priorityFee }),
        transactionMessage
      );

      return transactionWithPriorityFee;
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
  async getTransactionCount({ address: addressStr }) {
    if (!this.validateAddress({ address: addressStr })) {
      return null;
    }
    let signatures = await this.#getSignaturesForAddress(addressStr);
    let result = signatures.length;
    while (signatures.length === 1000) {
      const beforeSignature = signatures[signatures.length - 1].signature;
      const nextBatch = await this.#getSignaturesForAddress(addressStr, { before: beforeSignature });
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
 * @DONE
 */
  async getRawTransaction({ txid }) {
    if (!txid || !this.isBase58(txid)) {
      return null;
    }
    const tx = await this.rpc.getTransaction(signature(txid), { encoding: 'base64' }).send();
    if (!tx?.transaction) {
      return null;
    }
    return tx.transaction;
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
   * Sends a raw transaction to the network - do not await confirmation.
   * 
   * @param {Object} params - Parameters for sending the raw transaction.
   * @param {Uint8Array} params.rawTx - The raw transaction to be sent.
   * @returns {Promise<string|null>} A promise that resolves to the transaction ID or null if the transaction is invalid.
   */
  async sendRawTransaction({ rawTx }) {
    const serializedTransaction = this.uint8ArrayToBase64(rawTx);
    const signature = await this.rpc.sendTransaction(serializedTransaction, { encoding: 'base64' }).send();
    return signature;
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
 * @DONE
 */
  async getConfirmations({ txid }) {
    if (!txid || !this.isBase58(txid)) {
      return null;
    }
    const { value: statuses } = await this.rpc.getSignatureStatuses([signature(txid)]).send();
    if (statuses.length === 0) {
      throw new Error('Signature status could not be determined for provided txid');
    }

    const status = statuses[0];
    if (status.confirmations) {
      return status.confirmations;
    }

    const latestSlot = await this.rpc.getSlot({ commitment: 'confirmed' }).send();
    if (status.slot) {
      return latestSlot - status.slot;
    }

    const tx = await this.rpc.getTransaction(signature(txid), this._versionedConfig).send();
    if (tx?.slot) {
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

  async #getLatestBlockhash() {
    const { value } = await this.rpc.getLatestBlockhash().send();
    return value;
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