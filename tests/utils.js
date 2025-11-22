const { expect } = require('chai');
const utils = require('../lib/utils');

describe('BI', function() {
  it('should divide', function() {
    const result = utils.BI.div(10n, 3n);
    expect(result).to.equal('3.333333333333333');
  });
});