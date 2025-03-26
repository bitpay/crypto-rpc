const SolRPC = require('./SolRpc');
const SolKit = require('@solana/kit');
const SolToken = require('@solana-program/token');
const { pipe } = require('@solana/functional');

class SplRPC extends SolRPC {
  constructor(config) {
    super(config);
  }

  /**
   * @param {Object} params
   * @param {*} params.transactionMessage 
   * @param {number | bigint} params.amount 
   * @param {SolKit.Address<string>} params.destination 
   * @param {SolKit.KeyPairSigner<string>} params.source
   * @param {SolKit.KeyPairSigner<string>} params.feePayer
   * @param {string} [params.mintAddress] - Ignored for SolRPC, required for SplRPC
   * @param {number} [params.decimals] - Ignored for SolRPC, reequired for SplRPC 
   */
  async #appendTransferInstruction({ transactionMessage, amount, destination, source, feePayer, mintAddress, decimals }) {
    const mint = SolKit.address(mintAddress);

    const [destinationAta, sourceAta] = await Promise.all([
      this.getOrCreateAta({ owner: destination, mint, feePayer }),
      this.getOrCreateAta({ owner: source.address, mint, feePayer })
    ]);

    const transferCheckedTransactionMessage = SolKit.appendTransactionMessageInstructions([
      SolToken.getTransferCheckedInstruction({
        source: sourceAta,
        mint,
        destination: destinationAta,
        amount,
        decimals
      })
    ], transactionMessage);
    return transferCheckedTransactionMessage;
  }

  /**
   * @param {Object} params
   * @param {SolKit.Address<string>} params.owner
   * @param {string} params.mint
   * @param {SolKit.KeyPairSigner<string>} params.feePayer
   */
  async getOrCreateAta({ owner, mint, feePayer }) {
    // Already exists?
    const parsedTokenAccountsByOwner = await this.rpc.getTokenAccountsByOwner(owner, { mint }, { encoding: 'base64' }).send();
    let ata = parsedTokenAccountsByOwner?.value?.[0]?.pubkey;
    if (ata) {
      return ata;
    }
    const [destinationAta] = await SolToken.findAssociatedTokenPda({
      owner,
      tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      mint
    });

    const { value: latestBlockhash } = await this.rpc.getLatestBlockhash().send();

    // Compose instruction
    const createAssociatedTokenIdempotentInstruction = SolToken.getCreateAssociatedTokenIdempotentInstruction({
      payer: feePayer,
      owner,
      mint,
      ata: destinationAta
    });

    // Compose transaction message
    const transactionMessage = pipe(
      SolKit.createTransactionMessage({ version: 'legacy' }),
      (tx) => SolKit.setTransactionMessageFeePayerSigner(feePayer, tx),
      (tx) => SolKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => SolKit.appendTransactionMessageInstructions(
        [createAssociatedTokenIdempotentInstruction],
        tx
      )
    );

    const signedTransactionMessage = await SolKit.signTransactionMessageWithSigners(transactionMessage);
    const sendAndConfirmTransaction = SolKit.sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'finalized' });
    return destinationAta;
  }
}

module.exports = SplRPC;