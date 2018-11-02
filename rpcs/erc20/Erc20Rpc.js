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
      const decimals = this.web3.utils.toBN(await this.erc20Contract.methods.decimals().call());
      const TEN = this.web3.utils.toBN(10);
      const bigNumAmount = this.web3.utils.toBN(amount);
      const scaledAmount = bigNumAmount.mul(TEN.pow(decimals)).toString();
      const gasPrice = await this.estimateGasPrice();
      this.erc20Contract.methods
        .transfer(address, scaledAmount)
        .send({ from: this.account, gasPrice },
          (err, result) => {
            callback(err, { result });
          });
    } catch (err) {
      if (callback) {
        return callback(err);
      }
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
      if (callback) {
        return callback(err);
      }
    }
  }
}

module.exports = Erc20RPC;
