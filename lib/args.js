const program = require('commander');


const ERC20Currencies = ['ETH', 'PAX', 'USDC', 'GUSD'];
const chainEQCurrencies = ['BTC', 'BCH'];

program
  .option('--node <node>')
  .option('--currency <currency>')
  .option('--address <address>')
  .option('--port <port>')
  .option('--host <host>')
  .option('--user <user>')
  .option('--password <password>')
  .option('--protocol <protocol>')
  .option('--token <token>');

function chainFromCurrency(currency) {
  if (ERC20Currencies.includes(currency)) {
    return 'ETH';
  }
  if (chainEQCurrencies.includes(currency)) {
    return currency;
  }
  throw new Error('Unknown Currency');
}

let params;

try{
  program.parse(process.argv);
} catch (e) {
  console.error(e.message);
  program.help();
  process.exit(1);
}

try {
  const config = require('../config');
  const rpcHost = config[program.node];
  params = {
    ...rpcHost,
    ...program
  };
} catch (error) {
  params = { ...program };
}

if (program.currency) {
  params.chain = chainFromCurrency(program.currency);
}

if (!params.protocol) {
  params.protocol = 'http';
}

module.exports = params;