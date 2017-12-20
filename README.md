# hashed-timelock-contract-ethereum
An implementation of a Hashed Timelock Contract on Ethereum.

Use this contract for creating locks on the ETH side of a cross chain atomic swap (for example the [xcat](https://github.com/chatch/xcat) project).

 Deployment:
 * Ropsten: [0x131c7BA3eC8eBE69a6c58D084FD70aDFaCEC76c5](https://ropsten.etherscan.io/address/0x131c7BA3eC8eBE69a6c58D084FD70aDFaCEC76c5)
 * Rinkeby: [0x12b3432188978a31f6e9a30a0de304b1a8f78722](https://rinkeby.etherscan.io/address/0x12b3432188978a31f6e9a30a0de304b1a8f78722)
 * Mainnet: <not deployed yet ...>

## Protocol

### Main flow - receiver withdraws the funds before timelock expiry
![](docs/sequence-diagram-success.png?raw=true)

### Timelock expires - sender gets refund
![](docs/sequence-diagram-refund.png?raw=true)


## Interface

1. newContract(receiverAddress, hashlock, timelock) - create new hashed timelock contract with given receiver, hashlock and expiry
2. withdraw(preimage) - funds unlocked and transfered to the receiver who calls this when the preimage is known to them (most likely after a transaction on the other chain was posted revealing it)
3. refund() - in the event that the funds were not unlocked by the receiver, the sender (contract creator) can get a refund by calling this some time after the time lock has expired.

See the tests [here](https://github.com/chatch/hashed-timelock-contract-ethereum/blob/master/test/htlc.js) for examples of javascript clients using the contract.

## ABI and Bytecode

see [HashedTimelock.json](https://github.com/chatch/hashed-timelock-contract-ethereum/blob/master/build/contracts/HashedTimelock.json)

## Query

getContract(contractId) - get contract details

For example to assert details of a contract are as expected you could do:

```
htlc.getContract.call(contractId).then(contract => {
  assert.equal(contract[0], sender)
  assert.equal(contract[1], receiver)
  assert.equal(contract[2], oneFinney)
  assert.equal(contract[3], hashPair.hash)
  assert.equal(contract[4].toNumber(), timeLock1Hour)
  assert.isFalse(contract[5]) // withdrawn flag
  assert.isFalse(contract[6]) // refunded flag
  assert.equal(contract[7], preimage) // some preimage if it revealed already
})
```
