const crypto = require('crypto')
const HashedTimelock = artifacts.require('./HashedTimelock.sol')

// pre Metropolis failed require() gives invalid opcode
const REQUIRE_FAILED_MSG =
  'VM Exception while processing transaction: invalid opcode'

const hourSeconds = 3600
const nowSeconds = () => Math.floor(Date.now() / 1000)
const timeLock1Hour = nowSeconds() + hourSeconds

// Format required for sending bytes through eth client:
//  - hex string representation
//  - prefixed with 0x
const bufToStr = b => '0x' + b.toString('hex')
const sha256 = x =>
  crypto
    .createHash('sha256')
    .update(x)
    .digest()
const random32 = () => crypto.randomBytes(32)

const isSha256Hash = hashStr => /^0x[0-9a-f]{64}$/i.test(hashStr)
const newSecretHashPair = () => {
  const secret = random32()
  const hash = sha256(secret)
  return {
    secret: bufToStr(secret),
    hash: bufToStr(hash),
  }
}

const gasPrice = 100000000000 // truffle fixed gas price
const txGas = txReceipt => txReceipt.receipt.gasUsed * gasPrice
const txRetVal = txReceipt => txReceipt.receipt.logs[0].data
const oneFinney = web3.toWei(1, 'finney')

contract('HashedTimelock', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]

  it('should reject new contract request when no ETH sent', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed()
      .then(htlc =>
        htlc.newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: 0,
        })
      )
      .then(tx => assert.fail('expected failure due to 0 value transferred'))
      .catch(err => {
        assert.equal(REQUIRE_FAILED_MSG, err.message)
        done()
      })
  })

  it('should reject timelocks in the past', done => {
    const hashPair = newSecretHashPair()
    const pastTimelock = nowSeconds() - 1
    HashedTimelock.deployed()
      .then(htlc =>
        htlc.newContract(receiver, hashPair.hash, pastTimelock, {
          from: sender,
          value: oneFinney,
        })
      )
      .then(tx => assert.fail('expected failure due past timelock'))
      .catch(err => {
        assert.equal(REQUIRE_FAILED_MSG, err.message)
        done()
      })
  })

  it('should reject a duplicate contract request', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(tx =>
          // now call again with the exact same parameters
          htlc.newContract(receiver, hashPair.hash, timeLock1Hour, {
            from: sender,
            value: oneFinney,
          })
        )
        .then(tx => assert.fail('expected failure due to duplicate request'))
        .catch(err => {
          assert.equal(REQUIRE_FAILED_MSG, err.message)
          done()
        })
    )
  })

  it('should create new contract and store correct details', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(txReceipt => {
          const contractId = txRetVal(txReceipt)
          assert(isSha256Hash(contractId))
          return htlc.getContract.call(contractId)
        })
        .then(contract => {
          assert.equal(contract[0], sender)
          assert.equal(contract[1], receiver)
          assert.equal(contract[2], oneFinney)
          assert.equal(contract[3], hashPair.hash)
          assert.equal(contract[4].toNumber(), timeLock1Hour)
          assert.isFalse(contract[5])
          assert.isFalse(contract[6])
          done()
        })
    )
  })

  it('should let receiver withdraw with the secret preimage', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txRetVal(newContractTx)
          const receiverBalBefore = web3.eth.getBalance(receiver)

          // receiver calls withdraw with the secret to get the funds
          htlc
            .withdraw(contractId, hashPair.secret, {from: receiver})
            .then(withdrawTx => {
              // Check contract funds are now at the receiver address
              const expectedBal = receiverBalBefore
                .plus(oneFinney)
                .minus(txGas(withdrawTx))
              assert(
                web3.eth.getBalance(receiver).equals(expectedBal),
                "receiver balance doesn't match"
              )
              return htlc.getContract.call(contractId)
            })
            .then(contract => {
              assert.isTrue(contract[5]) // withdrawn set
              assert.isFalse(contract[6]) // refunded still false
              done()
            })
        })
    )
  })

  it('should reject withdraw from the receiver with the wrong preimage', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txRetVal(newContractTx)

          // receiver calls withdraw with an invalid secret
          const wrongSecret = bufToStr(random32())
          htlc
            .withdraw(contractId, wrongSecret, {from: receiver})
            .then(tx =>
              assert.fail('expected failure due to 0 value transferred')
            )
            .catch(err => {
              assert.equal(REQUIRE_FAILED_MSG, err.message)
              done()
            })
        })
    )
  })

  it('should reject withdraw from somebody other then the receiver', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txRetVal(newContractTx)
          const someGuy = accounts[4]
          htlc
            .withdraw(contractId, hashPair.secret, {from: someGuy})
            .then(tx => assert.fail('expected failure due to wrong receiver'))
            .catch(err => {
              assert.equal(REQUIRE_FAILED_MSG, err.message)
              done()
            })
        })
    )
  })

  it('should reject refund from sender before the timelock expires', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txRetVal(newContractTx)
          htlc
            .refund(contractId, {from: sender})
            .then(tx => assert.fail('expected failure due to timelock'))
            .catch(err => {
              assert.equal(REQUIRE_FAILED_MSG, err.message)
              done()
            })
        })
    )
  })

  it('should allow refund after the timelock has expired', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc => {
      const curBlkTime = web3.eth.getBlock('latest').timestamp
      const timelock1Second = curBlkTime + 1

      htlc
        .newContract(receiver, hashPair.hash, timelock1Second, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txRetVal(newContractTx)

          // wait one second so we move past the timelock time
          setTimeout(() => {
            // send an unrelated transaction to move the Solidity 'now' value
            // (which equals the time of most recent block) past the locktime.

            // NOTE: this tx could be anything just to get a block mined; but
            // let's just create another htlc between other accounts and ignore
            // the result
            htlc
              .newContract(accounts[3], bufToStr(random32()), timeLock1Hour, {
                from: accounts[4],
                value: oneFinney,
              })
              .then(() => {
                // attempt to get the refund now we've moved past the timelock time
                const balBefore = web3.eth.getBalance(sender)
                htlc
                  .refund(contractId, {from: sender})
                  .then(tx => {
                    // Check contract funds are now at the senders address
                    const expectedBal = balBefore
                      .plus(oneFinney)
                      .minus(txGas(tx))
                    assert(
                      web3.eth.getBalance(sender).equals(expectedBal),
                      "sender balance doesn't match"
                    )
                    return htlc.getContract.call(contractId)
                  })
                  .then(contract => {
                    assert.isTrue(contract[6]) // refunded set
                    assert.isFalse(contract[5]) // withdrawn still false
                    done()
                  })
              })
          }, 1000)
        })
    })
  })
})
