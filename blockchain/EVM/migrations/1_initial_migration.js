// eslint-disable-next-line
var Migrations = artifacts.require('./Migrations.sol');

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
