const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');


module.exports = buildModule('ERC20', (m) => {
  const contract = m.contract('CryptoErc20');
  return { contract };
});
