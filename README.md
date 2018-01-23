# hashed-timelock-contract-ethereum

[![NPM Package](https://img.shields.io/npm/v/ethereum-htlc.svg?style=flat-square)](https://www.npmjs.org/package/ethereum-htlc)

[Hashed Timelock Contracts](https://en.bitcoin.it/wiki/Hashed_Timelock_Contracts) (HTLCs) for Ethereum:

* [HashedTimelock.sol](contracts/HashedTimelock.sol) - HTLC for native ETH token
* [HashedTimelockERC20.sol](contracts/HashedTimelockERC20.sol) - HTLC for ERC20 tokens

Use these contracts for creating HTLCs on the Ethereum side of a cross chain atomic swap (for example the [xcat](https://github.com/chatch/xcat) project).

## Deployment

HashedTimelock:

* Ropsten: [0x0c0c3ec813a311acc37c8fc77d3cda0f32bcdd4b](https://ropsten.etherscan.io/address/0x0c0c3ec813a311acc37c8fc77d3cda0f32bcdd4b)
* Mainnet: <not deployed yet ...>

HashedTimelockERC20:

* Ropsten: [0x42902c91ed93ac58f1c958806c8d22e7ea1835f8](https://ropsten.etherscan.io/address/0x42902c91ed93ac58f1c958806c8d22e7ea1835f8)
* Mainnet: <not deployed yet ...>

## Protocol - Native ETH

### Main flow

![](docs/sequence-diagram-htlc-eth-success.png?raw=true)

### Timelock expires

![](docs/sequence-diagram-htlc-eth-refund.png?raw=true)

## Protocol - ERC20

### Main flow

![](docs/sequence-diagram-htlc-erc20-success.png?raw=true)

### Timelock expires

![](docs/sequence-diagram-htlc-erc20-refund.png?raw=true)

## Interface

### HashedTimelock

1. `newContract(receiverAddress, hashlock, timelock)` create new HTLC with given receiver, hashlock and expiry; returns contractId bytes32
2. `withdraw(contractId, preimage)` claim funds revealing the preimage
3. `refund(contractId)` if withdraw was not called the contract creator can get a refund by calling this some time after the time lock has expired.

See [test/htlc.js](test/htlc.js) for examples of interacting with the contract from javascript.

### HashedTimelockERC20

1. `newContract(receiverAddress, hashlock, timelock, tokenContract, amount)` create new HTLC with given receiver, hashlock, expiry, ERC20 token contract address and amount of tokens
2. `withdraw(contractId, preimage)` claim funds revealing the preimage
3. `refund(contractId)` if withdraw was not called the contract creator can get a refund by calling this some time after the time lock has expired.

See [test/htlcERC20.js](test/htlcERC20.js) for examples of interacting with the contract from javascript.

## ABI and Bytecode

* [HashedTimelock.json](abi/HashedTimelock.json)
* [HashedTimelockERC20.json](abi/HashedTimelockERC20.json)
