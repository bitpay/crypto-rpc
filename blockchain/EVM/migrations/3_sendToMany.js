// eslint-disable-next-line
var SendToMany = artifacts.require('./SendToMany.sol');

module.exports = function(deployer) {
  deployer.deploy(SendToMany);
};
