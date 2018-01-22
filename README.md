# hashed-timelock-contract-ethereum

[![NPM Package](https://img.shields.io/npm/v/ethereum-htlc.svg?style=flat-square)](https://www.npmjs.org/package/ethereum-htlc)

[Hashed Timelock Contracts](https://en.bitcoin.it/wiki/Hashed_Timelock_Contracts) (HTLCs) for Ethereum:

* [HashedTimelock.sol](contracts/HashedTimelock.sol) - HTLC for native ETH token
* [HashedTimelockERC20.sol](contracts/HashedTimelockERC20.sol) - HTLC for ERC20 tokens

Use these contract for creating HTLCs on the Ethereum side of a cross chain atomic swap (for example the [xcat](https://github.com/chatch/xcat) project).

Deployment:

* Ropsten: [0x131c7BA3eC8eBE69a6c58D084FD70aDFaCEC76c5](https://ropsten.etherscan.io/address/0x131c7BA3eC8eBE69a6c58D084FD70aDFaCEC76c5)
* Mainnet: <not deployed yet ...>

## Protocol - Native ETH

### Main flow - receiver withdraws the funds before timelock expiry

![](docs/sequence-diagram-success.png?raw=true)

### Timelock expires - sender gets refund

![](docs/sequence-diagram-refund.png?raw=true)

## Protocol - ERC20

### Main flow - receiver withdraws the funds before timelock expiry

TODO

### Timelock expires - sender gets refund

TODO

## Interface

### HashedTimelock

1. `newContract(receiverAddress, hashlock, timelock)` create new HTLC with given receiver, hashlock and expiry; returns contractId bytes32
2. `withdraw(contractId, preimage)` claim funds revealing the preimage
3. `refund(contractId)` if withdraw was not called the contract creator can get a refund by calling this some time after the time lock has expired.

See the tests [here](test/htlc.js) for examples of javascript clients using the contract.

### HashedTimelockERC20

1. `newContract(receiverAddress, hashlock, timelock, tokenContract, amount)` create new HTLC with given receiver, hashlock, expiry, ERC20 token contract address and amount of tokens
2. `withdraw(contractId, preimage)` claim funds revealing the preimage
3. `refund(contractId)` if withdraw was not called the contract creator can get a refund by calling this some time after the time lock has expired.

See the tests [here](test/htlcERC20.js) for examples of javascript clients using the contract.

## ABI and Bytecode

* [HashedTimelock.json](abi/HashedTimelock.json)
* [HashedTimelockERC20.json](abi/HashedTimelockERC20.json)
