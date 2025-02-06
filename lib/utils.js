const utils = {};

utils.toNum = (val) => typeof val === 'bigint' ? Number(val) : val;
utils.toBI = (val) => (typeof val === 'bigint' || isNaN(val)) ? val : BigInt(val);

utils.objBItoNums = (obj) => {
  if (typeof obj === 'object') {
    return JSON.parse(JSON.stringify(obj, (key, value) => this.toNum(value)));
  }
  return this.toNum(obj);
};


/** BigInt mathemtatic utils */
utils.BI = {};

/**
 * Math.max() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigInt|Number|String>} nums  BigInts, Numbers, and/or Strings
 * @returns {BigInt|Number|String} Returns the max entry
 */
utils.BI.max = function(...nums) {
  return nums.reduce((max, cur) => cur > max ? cur : max, nums[0]);
};

/**
 * Math.min() for a mixed array of BigInts, Numbers, and Strings
 * @param {Array<BigInt|Number|String>} nums Array of BigInts, Numbers, and/or Strings
 * @returns {BigInt|Number|String} Returns the min entry
 */
utils.BI.min = function(...nums) {
  return nums.reduce((min, cur) => cur < min ? cur : min, nums[0]);
};

/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigInt|Number|String} numerator
 * @param {BigInt|Number|String} denominator
 * @param {BigInt|Number|String} precision (optional) Defaults to the max number of decimals in the inputs
 * @returns {Number}
 */
utils.BI.divToFloat = function(numerator, denominator, precision) {
  if (precision == null) {
    precision = Math.max(numerator.toString().split('.')[1]?.length || 0, denominator.toString().split('.')[1]?.length || 0);
  }
  const scaleFactor = 10n ** BigInt(precision);
  const scaledNumerator = BigInt(numerator) * scaleFactor;
  const quotient = scaledNumerator / BigInt(denominator);
  return Number(quotient) / (10 ** precision);
};

/**
 * Divide BigInts with precision. This works for Numbers and strings as well since it converts the inputs to BigInts
 * @param {BigInt|Number|String} numerator
 * @param {BigInt|Number|String} denominator
 * @param {BigInt|Number|String} precision (optional) Defaults to the max number of decimals in the inputs
 * @returns {String} Decimal in string format
 */
utils.BI.div = function(numerator, denominator, precision) {
  const scale = [numerator, denominator].reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);
  precision = precision || scale || 16;

  const scaleFactor = 10n ** BigInt(scale);
  const scaledNumerator = numerator * scaleFactor;
  const roundedQuotient = scaledNumerator / denominator;
  const diff = numerator - (roundedQuotient * denominator);
  let decimalsStr = '';
  if (diff > 0n) {
    decimalsStr = Number(diff) / Number(denominator);
    decimalsStr = decimalsStr.toString().slice(1); // trim the leading 0
  }
  return roundedQuotient.toString() + decimalsStr.substring(0, precision);
};

utils.BI.divCeil = function(numerator, denominator) {
  const quotient = utils.BI.div(numerator, denominator);
  const [int, decimals] = quotient.split('.');
  return decimals ? BigInt(int) + 1n : BigInt(int);
};

utils.BI.divFloor = function(numerator, denominator) {
  const quotient = utils.BI.div(numerator, denominator);
  const [int] = quotient.split('.');
  return BigInt(int);
};

/**
 * Multiply mixed numbers. If decimals are given, this maintains precision of any given decimals until the very end to get the most precise result.
 * E.g.: BI.mul(2n, 1.4) => 2.8 => 3n
 * E.g.: BI.mul(1n, 1.1) => 1.1 => 1n 
 *
 * @param  {...BigInt|Number|String} nums
 * @returns {BigInt} Returns a rounded BigInt
 */
utils.BI.mul = function(...nums) {
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
  }

  const scaleFactor = 10 ** precision;
  const retValScaled = nums.reduce((acc, cur) => {
    const curScaled = typeof cur === 'bigint' ? (cur * BigInt(scaleFactor)) : BigInt(cur * scaleFactor);
    return acc * curScaled;
  }, 1n).toString();
  return BigInt(retValScaled.slice(0, -precision)) + BigInt(Math.round('.' + retValScaled.slice(-precision)));
};


/**
 * Same as BI.mul() but returns the floor of the result
 * E.g.: BI.mul(2n, 1.4) => 2.8 => 2n
 * E.g.: BI.mul(1n, 1.1) => 1.1 => 1n
 *
 * @param  {...BigInt|Number|String} nums
 * @returns {BigInt} Returns a floor-rounded BigInt
 */
utils.BI.mulFloor = function(...nums) {
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
  }

  const scaleFactor = 10 ** precision;
  const retValScaled = nums.reduce((acc, cur) => {
    const curScaled = typeof cur === 'bigint' ? (cur * BigInt(scaleFactor)) : BigInt(cur * scaleFactor);
    return acc * curScaled;
  }, 1n).toString();
  return BigInt(retValScaled.slice(0, -precision));
};

/**
 * Same as BI.mul() but returns the ceiling of the result
 * E.g.: BI.mul(2n, 1.4) => 2.8 => 3n
 * E.g.: BI.mul(1n, 1.1) => 1.1 => 2n
 *
 * @param  {...BigInt|Number|String} nums
 * @returns {BigInt} Returns a ceiling-rounded BigInt
 */
utils.BI.mulCeil = function(...nums) {
  const precision = nums.reduce((p, num) => Math.max(p, num.toString().split('.')[1]?.length || 0), 0);

  if (precision == 0) {
    return nums.reduce((acc, cur) => acc * BigInt(cur), 1n);
  }

  const scaleFactor = 10 ** precision;
  const retValScaled = nums.reduce((acc, cur) => {
    const curScaled = typeof cur === 'bigint' ? (cur * BigInt(scaleFactor)) : BigInt(cur * scaleFactor);
    return acc * curScaled;
  }, 1n).toString();
  return BigInt(retValScaled.slice(0, -precision)) + retValScaled.slice(-precision) > 0 ? 1n : 0n;
};

utils.BI.avgCeil = function(arr) {
  if (!Array.isArray(arr)) {
    throw new Error('Input must be an array');
  }
  const sum = arr.reduce((sum, i) => sum + BigInt(i), 0n);
  return utils.BI.divCeil(sum, BigInt(arr.length));
};

utils.BI.abs = function(num) {
  return num < 0 ? -num : num;
};

utils.BI.sortAsc = function(arr) {
  return arr.sort((a, b) => Number(a - b));
};

utils.BI.sortDesc = function(arr) {
  return arr.sort((a, b) => Number(b - a));
};


module.exports = utils;