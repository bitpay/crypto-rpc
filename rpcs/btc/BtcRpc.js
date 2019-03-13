const BitcoinRPC = require('./bitcoin');
const promptly = require('promptly');

class BtcRpc {
  constructor(config) {
    this.config = config;
    this.rpc = new BitcoinRPC(this.config);
  }

  asyncCall(method, args) {
    return new Promise((resolve, reject) => {
      this.rpc[method](...args, (err, resp) => {
        err = err || (resp && resp.result && resp.result.errors);
        if(err){
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
    return new Promise((resolve, reject) => {
      const send = async (phrase) => {
        try {
          await this.asyncCall('walletPassPhrase', [phrase, 10]);
          const tx = await this.sendToAddress({ address, amount });
          await this.walletLock();
          resolve(tx);
        } catch (err) {
          reject(err);
        }
      };
      if (passphrase === undefined) {
        return promptly.password('> ', (err, phrase) => {
          if (err) {
            return reject(err);
          }
          return send(phrase);
        });
      } else {
        return send(passphrase);
      }
    });
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

  async getTransaction({ txid, detail = false}) {
    const tx = await this.asyncCall('getRawTransaction', [txid, 1]);
    if (detail) {
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
    return this.asyncCall('getRawTransaction', [txid]);
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
