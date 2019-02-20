var BitcoinRPC = require('./bitcoin');

class BtcRpc {
  constructor(config) {
    this.config = config;
    this.rpc = new BitcoinRPC(this.config);
  }

  asyncCall(method, args) {
    return new Promise((resolve, reject) => {
      this.rpc[method](...args, (err, resp) => {
        if(err || (resp && resp.result && resp.result.errors)){
          reject(err);
        } else {
          resolve(resp.result);
        }
      });
    });
  }

  async cmdlineUnlock({ time }) {
    return this.asyncCall('cmdlineUnlock', [time]);
  }

  async sendToAddress({ address, amount }) {
    return this.asyncCall('sendToAddress', [address, amount]);
  }

  async unlockAndSendToAddress({ address, amount, passphrase }) {
    await this.asyncCall('walletPassPhrase', [passphrase, 10]);
    const tx = await this.sendToAddress({ address, amount });
    await this.walletLock();
    return tx;
  }


  async walletLock() {
    return this.asyncCall('walletLock', []);
  }

  async estimateFee({ nBlocks }) {
    return this.asyncCall('estimateSmartFee', [nBlocks]);
  }

  async getBalance() {
    const balanceInfo = await this.asyncCall('getWalletInfo', []);
    return balanceInfo.balance;
  }

  async getBestBlockHash() {
    return this.asyncCall('getBestBlockHash', []);
  }

  async getTransaction({ txid, populateInputs = false}) {
    const tx = await this.asyncCall('getTransaction', [txid]);
    if (populateInputs) {
      tx.vin = tx.vin.map(async input => await this.getTransaction(input.txid));
    }

    return tx;
  }

  async getRawTransaction({ txid }) {
    return this.asyncCall('getRawTransaction', [txid]);
  }

  async sendRawTransactions({ rawTx }) {
    return this.asyncCall('sendRawTransaction', [rawTx]);
  }

  async decodeRawTransaction({ rawTx }) {
    return this.asyncCall('decodeRawTransaction', [rawTx]);
  }

  async getBlock({ hash }) {
    return this.asyncCall('getBlock', [hash]);
  }

  async getConfirmations({ txid }) {
    const tx = await this.getTransaction({ txid });
    if (tx.blockhash === undefined) {
      return 0;
    }
    const hash = await this.getBestBlockHash();
    const block = await this.getBlock({ hash });
    const txBlock = await this.getBlock({hash: tx.blockhash}); //tx without blockhash, add return zero if without blockhash
    const confirmations = (block.height - txBlock.height) + 1;
    return confirmations;
  }

  async getTip() {
    const blockchainInfo = await this.asyncCall('getblockchaininfo', []);
    const { blocks: height, bestblockhash: hash } = blockchainInfo;
    return { height, hash };
  }
}

module.exports = BtcRpc;
