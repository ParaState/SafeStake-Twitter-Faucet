const Web3 = require('web3');
const erc20_abi = require('./erc20Abi');

module.exports = async (toAddress) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(process.env.blockchain_rpc));
  const contract = new web3.eth.Contract(erc20_abi, process.env.erc20_address);
  const transferObjectEncoded = contract.methods.transfer(toAddress, process.env.erc20_token_amount_in_wei).encodeABI();

  const tx = {
    to: process.env.erc20_address,
    from: process.env.faucet_public_key,
    gasPrice: process.env.gas_price,
    gas: process.env.gas_limit,
    data: transferObjectEncoded,
  };

  return new Promise(async (resolve, reject) => {
    const signedTX = await web3.eth.accounts.signTransaction(tx, process.env.faucet_private_key);

    console.log(signedTX);

    web3.eth.sendSignedTransaction(signedTX.rawTransaction)
      .on('transactionHash', (hash) => {
        console.log(`Transaction: https://goerli.etherscan.io/tx/${hash}`);
        resolve({ status: 'success', message: hash });
      })
      .on('error', (error) => {
        console.log('error: ', error);
        reject({ status: 'error', message: error });
      });
  });
};
