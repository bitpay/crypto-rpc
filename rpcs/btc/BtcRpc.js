const BitcoinRPC = require('./bitcoin');
const promptly = require('promptly');

class BtcRpc {
  constructor(config) {
    this.config = config;
    this.rpc = new BitcoinRPC(this.config);
  }

  asyncCall(method, args) {
    return new Promise((resolve, reject) => {
      this.rpc[method](...args, (err, response) => {
        if (err instanceof Error) {
          return reject(err);
        }

        const { error, result } = response;
        if (error) {
          err = new Error(error.message);
          err.code = error.code; // used by methods below
          err.conclusive = true; // used by server
          return reject(err);
        }
        if (result && result.errors) {
          return reject(new Error(result.errors[0]));
        }
        return resolve(result);
      });
    });
  }

  async cmdlineUnlock({ time }) {
    return this.asyncCall('cmdlineUnlock', [time]);
  }

  async sendToAddress({ address, amount }) {
    return this.asyncCall('sendToAddress', [address, amount / 1e8]);
  }

  async unlockAndSendToAddress({ address, amount, passphrase }) {
    if (passphrase === undefined) {
      passphrase = await promptly.password('> ');
    }
    await this.asyncCall('walletPassPhrase', [passphrase, 10]);
    const tx = await this.sendToAddress({ address, amount });
    await this.walletLock();
    return tx;
  }

  async unlockAndSendToAddressMany({ payToArray, passphrase }) {
    if (passphrase === undefined) {
      passphrase = await promptly.password('> ');
    }
    await this.asyncCall('walletPassPhrase', [passphrase, 10]);
    const promises = payToArray.map(a => {
      const [address, amount] = a;
      return this.sendToAddress({ address, amount });
    });
    const txs = await Promise.all(promises);
    await this.walletLock();
    return txs;
  }

  async walletLock() {
    return this.asyncCall('walletLock', []);
  }

  async estimateFee({ nBlocks }) {
    const { feerate } = await this.asyncCall('estimateSmartFee', [nBlocks]);
    return feerate * 1e8;
  }

  async getBalance() {
    const balanceInfo = await this.asyncCall('getWalletInfo', []);
    return balanceInfo.balance * 1e8;
  }

  async getBestBlockHash() {
    return this.asyncCall('getBestBlockHash', []);
  }

  async getTransaction({ txid, detail = false }) {
    const tx = await this.getRawTransaction({ txid });

    if (tx && detail) {
      for (let input of tx.vin) {
        const prevTx = await this.getTransaction({ txid: input.txid });
        const utxo = prevTx.vout[input.vout];
        const { value } = utxo;
        const address = utxo.scriptPubKey.addresses && utxo.scriptPubKey.addresses.length && utxo.scriptPubKey.addresses[0];
        input = Object.assign(input, { value, address, confirmations: prevTx.confirmations });
      }
      tx.unconfirmedInputs = tx.vin.some(input => input.confirmations < 1);
      let totalInputValue = tx.vin.reduce((total, input) => total + input.value * 1e8, 0);
      let totalOutputValue = tx.vout.reduce((total, output) => total + output.value * 1e8, 0);
      tx.fee = totalInputValue - totalOutputValue;
    }

    return tx;
  }

  async getRawTransaction({ txid }) {
    try {
      return await this.asyncCall('getRawTransaction', [txid]);
    } catch (err) {
      if (err.code === -5) {
        return null;
      }
      throw err;
    }
  }

  async sendRawTransaction({ rawTx }) {
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
    if (!tx) {
      return null;
    }
    if (tx.blockhash === undefined) {
      return 0;
    }
    return tx.confirmations;
  }

  async getTip() {
    const blockchainInfo = await this.asyncCall('getblockchaininfo', []);
    const { blocks: height, bestblockhash: hash } = blockchainInfo;
    return { height, hash };
  }

  async validateAddress({ address }) {
    const validateInfo = await this.asyncCall('validateaddress', [address]);
    const { isvalid } = validateInfo;
    return isvalid;
  }
}

module.exports = BtcRpc;
