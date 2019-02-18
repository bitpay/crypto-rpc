var BitcoinRPC = require('./bitcoin');

class BtcRpc {
  constructor(config) {
    this.config = config;
    this.rpc = new BitcoinRPC(this.config);
  }

  asyncCall(method, args, cb) {
    if(cb) {
      return this.rpc[method](...args, (err, resp) => {
        if(err) {
          return cb(err);
        }
        cb(null, resp.result);
      });
    }
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

  async cmdlineUnlock(time, cb) {
    return this.asyncCall('cmdlineUnlock', [time], cb);
  }

  async sendToAddress(address, amount, cb) {
    return this.asyncCall('sendToAddress', [address, amount], cb);
  }

  async unlockAndSendToAddress(address, amount, callback, phrase) {
    try {
      try {
        await this.asyncCall('walletPassPhrase', [phrase, 10]);
      } catch (err) {
        console.error(err);
      }
      const tx = await this.sendToAddress(address, amount);
      try {
        await this.walletLock();
      } catch (err) {
        console.error(err);
      }
      if(callback) callback(null, tx);
      return tx;
    } catch (err) {
      console.error(err);
      if(err) callback(err);
    }
  }


  async walletLock(cb) {
    return this.asyncCall('walletLock', [], cb);
  }

  async estimateFee(nBlocks, cb) {
    return this.asyncCall('estimateSmartFee', [nBlocks], cb);
  }

  async getBalance(address, cb) {
    const balanceInfo = await this.asyncCall('getWalletInfo', [], cb);
    return balanceInfo.balance;
  }

  async getBestBlockHash(cb) {
    return this.asyncCall('getBestBlockHash', [], cb);
  }

  async getTransaction(txid, cb) {
    return this.asyncCall('getTransaction', [txid], cb);
  }

  async getRawTransaction(txid, cb) {
    return this.asyncCall('getRawTransaction', [txid], cb);
  }

  async decodeRawTransaction(rawTx, cb) {
    return this.asyncCall('decodeRawTransaction', [rawTx], cb);
  }

  async getBlock(hash, cb) {
    return this.asyncCall('getBlock', [hash], cb);
  }

  async getConfirmations(txid, cb) {
    try {
      const tx = await this.getTransaction(txid);
      if(tx.blockhash === undefined) {
        if(cb) cb(null, confirmations);
        return 0;
      }
      const blockHash = await this.getBestBlockHash();
      const block = await this.getBlock(blockHash);
      const txBlock = await this.getBlock(tx.blockhash); //tx without blockhash, add return zero if without blockhash
      const confirmations = (block.height - txBlock.height) + 1;
      if(cb) cb(null, confirmations);
      return confirmations;
    } catch (err) {
      if(cb) cb(err);
    }
  }
}

module.exports = BtcRpc;
