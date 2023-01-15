# SafeStake Twitter Faucet

![image](https://i.imgur.com/bhBsRkH.png)

# Requirements
* Npm
* Node.js
* Mysql

# Setup
* Create `.env` file based on `.env.example`
* Run `docker-compose up -d` to start Faucet app
* Visit `http://localhost:8001/faucet`

# Env
You can change the following in the `.env` file: 
* `faucet_private_key`: Private key of faucet account
* `faucet_public_key`: Public key of faucet account
* `erc20_token_amount_in_wei`: amount of State token to send Per request in wei unit
* `erc20_address`: State token contract address
* `blockchain_rpc`: RPC Provider URL of goerli Testnet Network
