# hashed-timelock-contract-ethereum

[![NPM Package](https://img.shields.io/npm/v/ethereum-htlc.svg?style=flat-square)](https://www.npmjs.org/package/ethereum-htlc)

[Hashed Timelock Contracts](https://en.bitcoin.it/wiki/Hashed_Timelock_Contracts) (HTLCs) for Ethereum:

- [HashedTimelock.sol](contracts/HashedTimelock.sol) - HTLC for native ETH token
- [HashedTimelockERC20.sol](contracts/HashedTimelockERC20.sol) - HTLC for ERC20 tokens

Use these contracts for creating HTLCs on the Ethereum side of a cross chain atomic swap (for example the [xcat](https://github.com/chatch/xcat) project).

## Run Tests
* Install truffle
* Install ganache [https://truffleframework.com/ganache](https://truffleframework.com/ganache)
* Launch and set the network ID to `4447`

```
$ npm i
$ truffle test
Using network 'test'.

Compiling ./test/helper/ASEANToken.sol...
Compiling ./test/helper/EUToken.sol...


  Contract: HashedTimelock
    ✓ newContract() should create new contract and store correct details (88ms)
    ✓ newContract() should fail when no ETH sent (62ms)
    ✓ newContract() should fail with timelocks in the past (76ms)
    ✓ newContract() should reject a duplicate contract request (161ms)
    ✓ withdraw() should send receiver funds when given the correct secret preimage (211ms)
    ✓ withdraw() should fail if preimage does not hash to hashX (121ms)
    ✓ withdraw() should fail if caller is not the receiver (134ms)
    ✓ withdraw() should fail after timelock expiry (1217ms)
    ✓ refund() should pass after timelock expiry (1182ms)
    ✓ refund() should fail before the timelock expiry (164ms)
    ✓ getContract() returns empty record when contract doesn't exist

  Contract: HashedTimelockERC20
    ✓ newContract() should create new contract and store correct details (225ms)
    ✓ newContract() should fail when no token transfer approved (123ms)
    ✓ newContract() should fail when token amount is 0 (103ms)
    ✓ newContract() should fail when tokens approved for some random account (232ms)
    ✓ newContract() should fail when the timelock is in the past (110ms)
    ✓ newContract() should reject a duplicate contract request (280ms)
    ✓ withdraw() should send receiver funds when given the correct secret preimage (343ms)
    ✓ withdraw() should fail if preimage does not hash to hashX (231ms)
    ✓ withdraw() should fail if caller is not the receiver  (314ms)
    ✓ withdraw() should fail after timelock expiry (2192ms)
    ✓ refund() should pass after timelock expiry (2443ms)
    ✓ refund() should fail before the timelock expiry (230ms)
    ✓ getContract() returns empty record when contract doesn't exist

  Contract: HashedTimelock swap between two ERC20 tokens
    ✓ Step 1: Alice sets up a swap with Bob in the ASEANToken contract (164ms)
    ✓ Step 2: Bob sets up a swap with Alice in the EUToken contract (143ms)
    ✓ Step 3: Alice as the initiator withdraws from the EUToken with the secret (134ms)
    ✓ Step 4: Bob as the counterparty withdraws from the ASEANToken with the secret learned from Alice's withdrawal (95ms)


  28 passing (12s)
```

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
