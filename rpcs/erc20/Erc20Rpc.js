const EthRPC = require('../eth/EthRpc');
const erc20 = require('./erc20.json');
const AbiDecoder = require('abi-decoder');
class Erc20RPC extends EthRPC {
  constructor(config) {
    super(config);
    this.tokenContractAddress = config.tokenContractAddress;
    this.erc20Contract = new this.web3.eth.Contract(erc20, this.tokenContractAddress);
  }

  // this will only work on ERC20 tokens with decimals
  async sendToAddress({ address, amount, passphrase}) {
    const gasPrice = await this.estimateGasPrice();
    const account = await this.getAccount();
    const contractData = this.erc20Contract.methods
      .transfer(address, amount).encodeABI();
    return this.web3.eth.personal
      .sendTransaction({ from: account, gasPrice, data: contractData, to: this.tokenContractAddress },
        passphrase, (err, result) => {
          if (err) throw err;
          return { result };
        });
  }

  async getBalance({ address }) {
    if (address) {
      const balance = await this.erc20Contract.methods.balanceOf(address).call();
      return balance;
    } else {
      const accounts = await this.web3.eth.getAccounts();
      const balances = [];
      for (let account of accounts) {
        const balance = await this.getBalance({ address: account });
        balances.push({ account, balance });
      }
      return balances;
    }
  }

  async decodeRawTransaction({ rawTx }) {
    const decodedEthTx = await super.decodeRawTransaction({rawTx});
    if (decodedEthTx.data) {
      AbiDecoder.addABI(erc20);
      decodedEthTx.decodedData = AbiDecoder.decodeMethod('0x' + decodedEthTx.data);
    }
    return decodedEthTx;
  }
}

module.exports = Erc20RPC;
