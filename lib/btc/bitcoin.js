var promptly = require('promptly');
var util = require('util');
var bitcoinDRPC = require('bitcoind-rpc');

function BitcoinRPC(opts) {
  opts = opts || {};

  var protocol = opts.protocol;
  var args = { protocol: protocol }; // to allow nodes without ssl (protocol: 'http')
  bitcoinDRPC.call(this, args);

  this.host = opts.host;
  this.port = opts.port;
  this.user = opts.user;
  this.pass = opts.pass;
  this.httpOptions = { rejectUnauthorized: false };
}
util.inherits(BitcoinRPC, bitcoinDRPC);

BitcoinRPC.prototype.cmdlineUnlock = function(timeout, callback) {
  var self = this;
  self.getWalletInfo(function(err, result) {
    if (err) {
      console.error(err);
      return callback(err);
    }
    if ('unlocked_until' in result.result) {
      if (result['unlocked_until']) {
        throw new Error('wallet is currently unlocked');
      }
      promptly.password('> ', function(err, phrase) {
        if (err) {
          return callback(err);
        }
        self.walletPassPhrase(phrase, timeout, function(err) {
          if (err) {
            return callback(err);
          } else {
            console.warn('wallet unlocked for ' + timeout + ' seconds');
            return callback(null, function(doneLocking) {
              self.walletLock(function(err) {
                if (err) {
                  console.error(err.message);
                } else {
                  console.error('wallet locked');
                }
                doneLocking && doneLocking();
              });
            });
          }
        });
      });
    } else {
      process.nextTick(function() {
        callback(null, function(doneLocking) {
          if (doneLocking) {
            process.nextTick(doneLocking);
          }
        });
      });
    }
  });
};

module.exports = BitcoinRPC;
