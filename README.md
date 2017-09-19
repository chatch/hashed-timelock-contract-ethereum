# hashed-timelock-contract-ethereum
An implementation of a Hashed Timelock Contract on Ethereum

Use this contract for creating locks on the ETH side of a cross chain atomic swap.

## Addresses
Ropsten: [0x661335475ca4697da9e8827cbb859834911a040b](https://ropsten.etherscan.io/address/0x661335475ca4697da9e8827cbb859834911a040b)

Rinkeby: [0x94Ac65c50B4B0618BC0cA7D374382F6C9e14D20F](https://rinkeby.etherscan.io/address/0x94Ac65c50B4B0618BC0cA7D374382F6C9e14D20F)

## Protocol

1. A contract is created by calling newContract() with the time lock expiry, hash lock hash and receivers address.
2. Funds can be unlocked by the reciever when they know the hash preimage by calling withdraw().
3. In the event that the funds were not unlocked by the receiver, the sender (contract creater) can get a refund by calling refund() some time after the time lock has expired.

See the tests [here](https://github.com/chatch/hashed-timelock-contract-ethereum/blob/master/test/htlc.js) for examples of javascript clients using the contract.
