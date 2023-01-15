const web3 = require('web3');

module.exports = (address) => web3.utils.isAddress(address);
