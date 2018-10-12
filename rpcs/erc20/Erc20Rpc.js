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
    const decimals = await this.erc20Contract.methods.decimals().call();
    const scaledAmount = Math.round(Math.pow(10, decimals) * amount);
    this.erc20Contract.methods
      .transfer(address, scaledAmount)
      .send({ from: this.account})
      .then(function(tx) {
        callback(null, { result: tx.transactionHash });
      });
  }


  async getBalance(address, cb) {
    if(address) {
      const balance = await this.erc20Contract.methods.balanceOf(address).call();
      if(cb) {
        return cb(null, balance);
      } else {
        return balance;
      }
    } else {
      const accounts = await this.web3.eth.getAccounts();
      const balances = [];
      for(let account of accounts) {
        const balance = await this.getBalance(account);
        balances.push({ account,  balance });
      }
      if(cb) {
        return cb(null, balances);
      } else {
        return balances;
      }
    }
  }
}

module.exports = Erc20RPC;
