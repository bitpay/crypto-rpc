// eslint-disable-next-line
var ERC20 = artifacts.require('./CryptoErc20.sol');

module.exports = function(deployer) {
  deployer.deploy(ERC20 );
};
