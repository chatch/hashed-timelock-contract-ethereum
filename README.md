# hashed-timelock-contract-ethereum

[![NPM Package](https://img.shields.io/npm/v/ethereum-htlc.svg?style=flat-square)](https://www.npmjs.org/package/ethereum-htlc)

[Hashed Timelock Contracts](https://en.bitcoin.it/wiki/Hashed_Timelock_Contracts) (HTLCs) for Ethereum:

- [HashedTimelock.sol](contracts/HashedTimelock.sol) - HTLC for native ETH token
- [HashedTimelockERC20.sol](contracts/HashedTimelockERC20.sol) - HTLC for ERC20 tokens

Use these contracts for creating HTLCs on the Ethereum side of a cross chain atomic swap (for example the [xcat](https://github.com/chatch/xcat) project).

## Deployment

HashedTimelock:

- Kovan: [0xc3ed16874bc9551b079c135eb27b10ee1348ac12](https://kovan.etherscan.io/address/0xc3ed16874bc9551b079c135eb27b10ee1348ac12)
- Ropsten:
  [0xbb6883511ff318ba85b5745fb1a6083537bf914c](https://ropsten.etherscan.io/address/0xbb6883511ff318ba85b5745fb1a6083537bf914c)
- Mainnet: <not deployed yet ...>

HashedTimelockERC20:

- Kovan: [0xfD4BEbA807E89E2cA209cd53c28471840446ddf2](https://kovan.etherscan.io/address/0xfD4BEbA807E89E2cA209cd53c28471840446ddf2)
- Ropsten: [0x6879e090240358f59fc5d212f87da63d3288749b](https://ropsten.etherscan.io/address/0x6879e090240358f59fc5d212f87da63d3288749b)
- Mainnet: <not deployed yet ...>

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

1.  `newContract(receiverAddress, hashlock, timelock)` create new HTLC with given receiver, hashlock and expiry; returns contractId bytes32
2.  `withdraw(contractId, preimage)` claim funds revealing the preimage
3.  `refund(contractId)` if withdraw was not called the contract creator can get a refund by calling this some time after the time lock has expired.

See [test/htlc.js](test/htlc.js) for examples of interacting with the contract from javascript.

### HashedTimelockERC20

1.  `newContract(receiverAddress, hashlock, timelock, tokenContract, amount)` create new HTLC with given receiver, hashlock, expiry, ERC20 token contract address and amount of tokens
2.  `withdraw(contractId, preimage)` claim funds revealing the preimage
3.  `refund(contractId)` if withdraw was not called the contract creator can get a refund by calling this some time after the time lock has expired.

See [test/htlcERC20.js](test/htlcERC20.js) for examples of interacting with the contract from javascript.

## ABI and Bytecode

- [HashedTimelock.json](abi/HashedTimelock.json)
- [HashedTimelockERC20.json](abi/HashedTimelockERC20.json)
