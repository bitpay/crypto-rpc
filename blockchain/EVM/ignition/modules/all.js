const hardhat = require('hardhat');
const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');
const fs = require('fs');

const sequential = process.env.HH_SEQUENTIAL_DEPLOY == '1' || hardhat.network.config['sequentialDeploy'];
if (sequential) {
  // eslint-disable-next-line no-console
  console.log('Sequential deployment enabled');
}


module.exports = buildModule('Deploy_All', (m) => {
  const mods = fs.readdirSync(__dirname);
  let prev;
  for (const mod of mods) {
    if (mod === __filename.split('/').pop()) {
      continue;
    }
    const contracts = m.useModule(require(`${__dirname}/${mod}`));
    if (sequential) { // sequentially deploy the contracts instead of in parallel
      if (prev) {
        for (const contract of Object.values(contracts)) {
          contract.dependencies.add(prev);
        }
      }
      prev = Object.values(contracts)[0];
    }
  }
});
