const Web3 = require('@solana/web3.js');
const EventEmitter = require('events');
const bs58 = require('bs58');
const { Buffer } = require('buffer');
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
    this.connection = this.initConnection(this.config);
    this.emitter = new EventEmitter();
    // configuration for retrieving versioned blocks and transactions
    this._versionedConfig = {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    };
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
   * @returns {Web3.Connection} A new Web3 Connection instance.
   */
  initConnection(connectionConfig) {
    const { protocol, host, port } = connectionConfig;
    if (!protocol || !['wss', 'http', 'https'].includes(protocol.toLowerCase())) {
      throw new Error('Please provide a valid protocol');
    }
    const connectionString = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
    return new Web3.Connection(connectionString, 'confirmed');
  }

  getConnection() {
    return this.connection;
  }

  /**
   * Retrieves the balance of the specified address.
   * 
   * @param {Object} params - The parameters for retrieving the balance.
   * @param {string} params.address - The public key of the address to check the balance for.
   * @returns {Promise<number|null>} The balance of the specified address in lamports.
   */
  async getBalance({ address }) {
    if (!this.validateAddress({ address })) {
      return null;
    }
    return await this.connection.getBalance(this.toAddress(address));
  }

  /**
   * Sends a specified amount of lamports to a given address, either through a versioned or legacy transaction.
   * 
   * @param {Object} params - The parameters for the transaction.
   * @param {string} params.address - The public key of the recipient.
   * @param {number} params.amount - The amount of lamports to send.
   * @param {string} params.fromAccount - The public key of the sender.
   * @param {Object} params.fromAccountKeypair - The keypair of the sender.
   * @param {string} [params.txType='legacy'] - The type of transaction ('legacy' or '0' for versioned).
   * @param {boolean} [params.priority=false] - Whether to add a priority fee to the transaction.
   * @returns {Promise<string>} The transaction hash.
   * @throws {Error} If the transaction confirmation returns an error.
   */
  async sendToAddress({ address, amount, fromAccountKeypair, txType = 'legacy', priority }) {
    try {
      if (!(fromAccountKeypair instanceof Web3.Keypair)) {
        throw new Error('Invalid Solana Keypair object');
      }
      
      const fromAccount = fromAccountKeypair.publicKey;
      address = new Web3.PublicKey(address);
      const block = await this.getTip();      

      if (txType == 0) {
        // versioned tx
        return await this._sendToAddressType0({ address, amount, fromAccount, fromAccountKeypair, priority, block });
      } else {
        // legacy
        return await this._sendToAddressTypeLegacy({ address, amount, fromAccount, fromAccountKeypair, priority, block });
      }
    } catch (err) {
      this.emitter.emit('failure', err);
      throw err;
    }
  }

  async _sendToAddressType0({ address, amount, fromAccount, fromAccountKeypair, priority, block }) {
    const instructions = [
      Web3.SystemProgram.transfer({
        fromPubkey: fromAccount,
        toPubkey: address,
        lamports: BigInt(amount)
      })
    ];
    const message = new Web3.TransactionMessage({
      payerKey: fromAccount,
      recentBlockhash: block.hash,
      instructions
    }).compileToV0Message();
    let transaction = new Web3.VersionedTransaction(message);
    if (priority) {
      transaction = await this.addPriorityFee({ transaction });
    }
    transaction.sign([fromAccountKeypair]);

    const txid = await this.connection.sendTransaction(transaction, { maxRetries: 5 });
    const confirmation = await this.connection.confirmTransaction({
      signature: txid,
      blockhash: block.hash,
      lastValidBlockHeight: block.height
    });

    if (confirmation.value.err) { throw new Error(confirmation.value.err); }
    return txid;
  }

  async _sendToAddressTypeLegacy({ address, amount, fromAccount, fromAccountKeypair, priority, block }){
    let transaction = new Web3.Transaction({
      blockhash: block.hash,
      feePayer: fromAccount,
      lastValidBlockHeight: block.height
    });
    const transfer = Web3.SystemProgram.transfer({
      fromPubkey: fromAccount,
      toPubkey: address,
      lamports: BigInt(amount)
    });

    transaction.add(transfer);
    if (priority) {
      transaction = await this.addPriorityFee({ transaction });
    }
    return await Web3.sendAndConfirmTransaction(
      this.connection,
      transaction,
      [fromAccountKeypair]
    );
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
   */
  async estimateFee({ nBlocks = 10, rawTx }) {
    if (rawTx) {
      // Recommended. Directly estimate fee based on the provided raw transaction size.
      return await this.estimateTransactionFee({ rawTx });
    }

    // Fee can be a caclculeted by (Number of Signatures × Lamports per Signature)
    // Calculate the average lamports per signature over the past n blocks
    const samples = await this.connection.getRecentPerformanceSamples(nBlocks);
    let totalFees = 0;
    let totalBlocks = 0;
    const minFee = 5000; // Set a minimum fee per signature in lamports
    for (const sample of samples) {
      const { blockhash } = await this.getBlock({ height: sample.slot });
      if (blockhash) {
        const feeCalculator = await this.connection.getFeeCalculatorForBlockhash(blockhash, 'confirmed');
        if (feeCalculator && feeCalculator.value) {
          totalFees += feeCalculator.value.lamportsPerSignature;
          totalBlocks++;
        }
      }
    }
    // Return the average fee or the minimum fee if no blocks were processed
    return totalBlocks > 0 ? (totalFees / totalBlocks) : minFee;
  }

  /**
   * Estimates the transaction fee based on the provided raw transaction data.
   * 
   * @param {Object} options - The options for fee estimation.
   * @param {string} options.rawTx - The raw transaction data for direct fee estimation.
   * @returns {Promise<number>} The estimated fee in lamports.
   * @throws Will throw an error if the fee estimation fails or tx cannot be decoded.
   */
  async estimateTransactionFee({ rawTx }) {
    const tx = this.decodeRawTransaction({ rawTx });
    if (!tx) {
      throw new Error('Could not decode provided raw transaction');
    }
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.message.recentBlockhash = blockhash;
    // Estimate the fee
    const feeCalculator = await this.connection.getFeeForMessage(tx.message);

    if (!feeCalculator || !feeCalculator.value) {
      throw new Error('Failed to estimate transaction fee');
    }

    return feeCalculator.value;
  }

  /**
   * Estimates the maximum priority fee based on recent transaction fees and a specified percentile.
   * This function retrieves recent prioritization fees and calculates the fee at the given percentile.
   * The fee is the per-compute-unit fee paid by at least one successfully landed transaction
   * 
   * @param {Object} config - Configuration options for retrieving prioritization fees.
   * @param {number} [percentile=25] - The percentile (0-100) of fees to consider for maximum priority fee estimation.
   * @returns {Promise<number|null>} The estimated maximum priority fee or null if no fees are available.
   */
  async estimateMaxPriorityFee({ config, percentile = 25 }) {
    const recentFees = await this.connection.getRecentPrioritizationFees(config);
    if (!recentFees || recentFees.length === 0) {
      return null;
    }
    const priorityFees = recentFees
      .map(fee => fee.prioritizationFee)
      .filter(x => Number(x) > 0)
      .sort((a, b) => a - b);
    if (!priorityFees || priorityFees.length === 0) {
      return 0;
    }
    const feeIdx = Math.floor(priorityFees.length * (percentile / 100)) - Math.floor(percentile / 100);
    return priorityFees[feeIdx];
  }

  /**
   * Adds a priority fee to the given transaction based on recent prioritization fees.
   * This function modifies the compute unit limit and sets the compute unit price for the transaction.
   * 
   * @param {Object} params - Parameters for adding priority fee.
   * @param {Web3.VersionedTransaction} params.transaction - The transaction to which the priority fee will be added.
   * @param {number} [params.unitLimit=300] - The compute unit limit to set for the transaction.
   * @param {Object} params.config - Configuration options for retrieving prioritization fees.
   * @returns {Promise<Web3.VersionedTransaction>} The modified transaction with the added priority fee.
   * @throws Will throw an error if adding the priority fee fails for reasons other than 'Method not found'.
   */
  async addPriorityFee({ transaction, unitLimit = 300, config }) {
    try {
      const priorityFee = await this.estimateMaxPriorityFee({ config });
      const modifyComputeUnits = Web3.ComputeBudgetProgram.setComputeUnitLimit({ units: unitLimit });
      const addPriorityFee = Web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee });
      transaction = transaction
        .add(modifyComputeUnits)
        .add(addPriorityFee);
    } catch (err) {
      if (err && err.message !== 'failed to get recent prioritization fees: Method not found') {
        this.emitter.emit('failure', err);
        throw err;
      }
      console.warn('Priority fee\'s are not supported by this cluster', err);
    }
    return transaction;
  }

  /**
   * Retrieves the hash of the best block (tip) in the blockchain.
   * This function fetches the tip of the blockchain and returns its hash.
   * 
   * @returns {Promise<string|null>} The hash of the best block or null if the tip is not available.
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
   * @returns {Promise<Web3.VersionedTransactionResponse|null>} The transaction object if found, otherwise null.
   */
  async getTransaction({ txid }) {
    if (!txid || !this.isBase58(txid)) {
      return null;
    }
    const tx = await this.connection.getTransaction(txid, this._versionedConfig);
    if (!tx) {
      return null;
    }
    return tx;
  }

  /**
   * Get all transactions for an account
   * @param {Object} params - Parameters for retrieving transactions.
   * @param {string} params.address - Account address to get transactions for.
   * @returns {Promise<Array<Web3.VersionedTransactionResponse>|null>} A promise that resolves to an array of transactions.
   */
  async getTransactions({ address }) {
    if (!this.validateAddress({ address })) {
      return null;
    }
    const pubkey = new Web3.PublicKey(address);
    const txids = await this.connection.getSignaturesForAddress(pubkey);
    const transactions = [];

    // Fetch transaction details for each signature
    for (const txid of txids) {
      try {
        const tx = await this.connection.getTransaction(txid.signature, this._versionedConfig);
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
   */
  async getTransactionCount({ address }) {
    if (!this.validateAddress({ address })) {
      return null;
    }
    const key = new Web3.PublicKey(address);
    let signatures = await this.connection.getSignaturesForAddress(key);
    let result = signatures.length;
    while (signatures.length === 1000) {
      const beforeSignature = signatures[signatures.length - 1].signature;
      const nextBatch = await this.connection.getSignaturesForAddress(key, { before: beforeSignature });
      signatures = nextBatch;
      result += signatures.length;
    }

    return result;
  }

  /**
   * Retrieves and serializes a raw transaction by its transaction ID.
   * 
   * @param {Object} params - Parameters for retrieving the raw transaction.
   * @param {string} params.txid - The transaction ID of the transaction to retrieve.
   * @returns {Promise<string|null>} A promise that resolves to the raw transaction as a base64 string or null if not found.
   */
  async getRawTransaction({ txid }) {
    if (!txid || !this.isBase58(txid)) {
      return null;
    }
    const tx = await this.connection.getTransaction(txid, this._versionedConfig);
    if (!tx || !tx.transaction || !tx.transaction.signatures) {
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
   * @returns {Web3.VersionedTransaction|null} The decoded transaction or null if the input is invalid.
   */
  decodeRawTransaction({ rawTx }) {
    if (rawTx && typeof rawTx === 'string') {
      rawTx = this.base64ToUint8Array(rawTx);
    }
    if (!(rawTx instanceof Uint8Array)) {
      return null;
    }
    return Web3.VersionedTransaction.deserialize(rawTx);
  }

  /**
   * Sends a raw transaction to the network.
   * 
   * @param {Object} params - Parameters for sending the raw transaction.
   * @param {Uint8Array} params.rawTx - The raw transaction to be sent.
   * @returns {Promise<string|null>} A promise that resolves to the transaction ID or null if the transaction is invalid.
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
   * @returns {Promise<Web3.BlockResponse|null>} A promise that resolves to the block object or null if not found.
   * @throws {Error} If hash is provided instead of height.
   */
  async getBlock({ hash, height }) {
    if (Number.isInteger(height)) {
      return await this.connection.getBlock(height, this._versionedConfig);
    }
    if (hash) {
      throw new Error('Hash is not supported. Provide a height instead');
    }
    return null;
  }

  /**
   * Get the number of confirmations for a given transaction ID.
   * 
   * @param {Object} params - The parameters for the function.
   * @param {string} params.txid - The transaction ID to get confirmations for.
   * @returns {Promise<number|null>} - The number of confirmations or null if not available.
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
   * @returns {Promise<Object>} - An object containing the height (slot) and hash of the current block.
   */
  async getTip() {
    const height = await this.connection.getSlot({ commitment: 'confirmed' });
    const block = await this.connection.getBlock(height, this._versionedConfig);
    return { height, hash: block.blockhash };
  }

  getTxOutputInfo() {
    return null;
  }

  /**
   * Validates a given address.
   * 
   * @param {Object} params - The parameters for the function.
   * @param {string} params.address - The address to validate.
   * @returns {boolean} - Returns true if the address is valid, otherwise false.
   */
  validateAddress({ address }) {
    try {
      this.toAddress(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  getAccountInfo() {
    return {};
  }

  /**
   * Retrieves the version information from the Solana node.
   * 
   * @returns {Promise<Web3.Version>} - The version information of the Solana node.
   */
  async getServerInfo() {
    return await this.connection.getVersion();
  }

  /**
   * Checks if the given address is a valid Solana address.
   * 
   * @param {string} address - The address to validate.
   * @returns {boolean} True if the address is valid, false otherwise.
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
   * @param {string} address - The address to convert.
   * @returns {Web3.PublicKey} The converted Web3 PublicKey instance.
   */
  toAddress(address) {
    return new Web3.PublicKey(address);
  }

  /**
   * Converts the given input to a Buffer instance.
   * 
   * @param {Array|Uint8Array|Buffer} arr - The input to convert.
   * @returns {Buffer} The converted Buffer instance.
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
   */
  uint8ArrayToBase64(arr) {
    return this.toBuffer(arr).toString('base64');
  }
}

module.exports = SolRPC;