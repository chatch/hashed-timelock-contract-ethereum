# hashed-timelock-contract-ethereum

[![NPM Package](https://img.shields.io/npm/v/ethereum-htlc.svg?style=flat-square)](https://www.npmjs.org/package/ethereum-htlc)

[Hashed Timelock Contracts](https://en.bitcoin.it/wiki/Hashed_Timelock_Contracts) (HTLCs) for Ethereum:

- [HashedTimelock.sol](contracts/HashedTimelock.sol) - HTLC for native ETH token
- [HashedTimelockERC20.sol](contracts/HashedTimelockERC20.sol) - HTLC for ERC20 tokens

Use these contracts for creating HTLCs on the Ethereum side of a cross chain atomic swap (for example the [xcat](https://github.com/chatch/xcat) project).

## Deployment

HashedTimelock:

- Kovan: [0xe196bb1e25483ed771b6691929d47943023c26fe](https://kovan.etherscan.io/address/0xe196bb1e25483ed771b6691929d47943023c26fe)
- Ropsten:
  [0x243785f6b65418191ea20b45fde7069ffe4f8cef](https://ropsten.etherscan.io/address/0x243785f6b65418191ea20b45fde7069ffe4f8cef)
- Mainnet: <not deployed yet ...>

HashedTimelockERC20:

- Kovan: [0x763eedd3c04a9a2fca67ac51fc16e394472f29a2](https://kovan.etherscan.io/address/0x763eedd3c04a9a2fca67ac51fc16e394472f29a2)
- Ropsten: [0x16b6fabc530c7bfde69eafd9e271fb610e3fc3f7](https://ropsten.etherscan.io/address/0x16b6fabc530c7bfde69eafd9e271fb610e3fc3f7)
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
