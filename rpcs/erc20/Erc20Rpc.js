const EthRPC = require('../eth/EthRpc');
const erc20 = require('./erc20.json');
class Erc20RPC extends EthRPC {
  constructor(config) {
    super(config);
    this.tokenContractAddress = config.currencyConfig.tokenContractAddress;
    this.erc20Contract = new this.web3.eth.Contract(erc20, this.tokenContractAddress);
  }

  // this will only work on ERC20 tokens with decimals
  async sendToAddress(address, amount, callback) {
    try {
      const decimals = await this.erc20Contract.methods.decimals().call();
      const scaledAmount = Math.round(Math.pow(10, decimals) * amount);
      this.erc20Contract.methods
        .transfer(address, scaledAmount)
        .send({ from: this.config.account }, (err, result) => {
          callback(err, { result });
        });
    } catch (err) {
      return callback(err);
    }
  }

  async getBalance(address, callback) {
    try {
      if (address) {
        const balance = await this.erc20Contract.methods.balanceOf(address).call();
        if (callback) {
          return callback(null, balance);
        } else {
          return balance;
        }
      } else {
        const accounts = await this.web3.eth.getAccounts();
        const balances = [];
        for (let account of accounts) {
          const balance = await this.getBalance(account);
          balances.push({ account,  balance });
        }
        if (callback) {
          return callback(null, balances);
        } else {
          return balances;
        }
      }
    } catch (err) {
      return callback(err);
    }
  }
}

module.exports = Erc20RPC;
