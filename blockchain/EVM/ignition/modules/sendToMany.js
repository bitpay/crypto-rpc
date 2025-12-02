const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');


module.exports = buildModule('SendToMany', (m) => {
  const contract = m.contract('SendToMany');
  return { contract };
});
