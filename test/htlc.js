import {
  bufToStr,
  fastForward,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txGas,
  txLoggedArgs,
} from './helper/utils'

const HashedTimelock = artifacts.require('./HashedTimelock.sol')

// pre Metropolis failed require() gives invalid opcode
const REQUIRE_FAILED_MSG =
  'VM Exception while processing transaction: invalid opcode'

const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const oneFinney = web3.toWei(1, 'finney')

const contractArrToObj = c => {
  return {
    sender: c[0],
    receiver: c[1],
    amount: c[2],
    hashlock: c[3],
    timelock: c[4],
    withdrawn: c[5],
    refunded: c[6],
    preimage: c[7],
  }
}

contract('HashedTimelock', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]

  it('newContract() should create new contract and store correct details', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(txReceipt => {
          const logArgs = txLoggedArgs(txReceipt)

          const contractId = logArgs.contractId
          assert(isSha256Hash(contractId))

          assert.equal(logArgs.sender, sender)
          assert.equal(logArgs.receiver, receiver)
          assert.equal(logArgs.amount, oneFinney)
          assert.equal(logArgs.hashlock, hashPair.hash)
          assert.equal(logArgs.timelock, timeLock1Hour)

          return htlc.getContract.call(contractId)
        })
        .then(contractArr => {
          const contract = contractArrToObj(contractArr)
          assert.equal(contract.sender, sender)
          assert.equal(contract.receiver, receiver)
          assert.equal(contract.amount, oneFinney)
          assert.equal(contract.hashlock, hashPair.hash)
          assert.equal(contract.timelock.toNumber(), timeLock1Hour)
          assert.isFalse(contract.withdrawn)
          assert.isFalse(contract.refunded)
          assert.equal(
            contract.preimage,
            '0x0000000000000000000000000000000000000000000000000000000000000000'
          )
          done()
        })
    )
  })

  it('newContract() should fail when no ETH sent', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed()
      .then(htlc =>
        htlc.newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: 0,
        })
      )
      .then(() => assert.fail('expected failure due to 0 value transferred'))
      .catch(err => {
        assert.equal(err.message, REQUIRE_FAILED_MSG)
        done()
      })
  })

  it('newContract() should fail with timelocks in the past', done => {
    const hashPair = newSecretHashPair()
    const pastTimelock = nowSeconds() - 1
    HashedTimelock.deployed()
      .then(htlc =>
        htlc.newContract(receiver, hashPair.hash, pastTimelock, {
          from: sender,
          value: oneFinney,
        })
      )
      .then(() => assert.fail('expected failure due past timelock'))
      .catch(err => {
        assert.equal(err.message, REQUIRE_FAILED_MSG)
        done()
      })
  })

  it('newContract() should reject a duplicate contract request', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(() =>
          // now call again with the exact same parameters
          htlc.newContract(receiver, hashPair.hash, timeLock1Hour, {
            from: sender,
            value: oneFinney,
          })
        )
        .then(() => assert.fail('expected failure due to duplicate request'))
        .catch(err => {
          assert.equal(err.message, REQUIRE_FAILED_MSG)
          done()
        })
    )
  })

  it('withdraw() should send receiver funds when given the correct secret preimage', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txContractId(newContractTx)
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
            .then(contractArr => {
              const contract = contractArrToObj(contractArr)
              assert.isTrue(contract.withdrawn) // withdrawn set
              assert.isFalse(contract.refunded) // refunded still false
              assert.equal(contract.preimage, hashPair.secret)
              done()
            })
        })
    )
  })

  it('withdraw() should fail if preimage does not hash to hashX', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txContractId(newContractTx)

          // receiver calls withdraw with an invalid secret
          const wrongSecret = bufToStr(random32())
          htlc
            .withdraw(contractId, wrongSecret, {from: receiver})
            .then(() =>
              assert.fail('expected failure due to 0 value transferred')
            )
            .catch(err => {
              assert.equal(err.message, REQUIRE_FAILED_MSG)
              done()
            })
        })
    )
  })

  it('withdraw() should fail if caller is not the receiver ', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txContractId(newContractTx)
          const someGuy = accounts[4]
          htlc
            .withdraw(contractId, hashPair.secret, {from: someGuy})
            .then(() => assert.fail('expected failure due to wrong receiver'))
            .catch(err => {
              assert.equal(err.message, REQUIRE_FAILED_MSG)
              done()
            })
        })
    )
  })

  it('withdraw() should fail after timelock expiry', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.new().then(htlc => {
      const curBlkTime = web3.eth.getBlock('latest').timestamp
      const timelock1Second = curBlkTime + 1

      htlc
        .newContract(receiver, hashPair.hash, timelock1Second, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txContractId(newContractTx)
          // wait one second so we move past the timelock time
          setTimeout(() => {
            // send an unrelated transaction to move the Solidity 'now' value
            // (which equals the time of most recent block) past the locktime.
            fastForward(web3).then(() => {
              // attempt to withdraw and check that it is not allowed
              htlc
                .withdraw(contractId, hashPair.secret, {from: receiver})
                .then(() =>
                  assert.fail(
                    'expected failure due to withdraw after timelock expired'
                  )
                )
                .catch(err => {
                  assert.equal(err.message, REQUIRE_FAILED_MSG)
                  done()
                })
            })
          }, 1000)
        })
    })
  })

  it('refund() should pass after timelock expiry', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.new().then(htlc => {
      const curBlkTime = web3.eth.getBlock('latest').timestamp
      const timelock1Second = curBlkTime + 1

      htlc
        .newContract(receiver, hashPair.hash, timelock1Second, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txContractId(newContractTx)

          // wait one second so we move past the timelock time
          setTimeout(() => {
            // send an unrelated transaction to move the Solidity 'now' value
            // (which equals the time of most recent block) past the locktime.
            fastForward(web3)
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
                  .catch(err =>
                    console.error(`caught error refund: ${err.message}`)
                  )
              })
              .catch(err =>
                console.error(`caught error newContract: ${err.message}`)
              )
          }, 2000)
        })
    })
  })

  it('refund() should fail before the timelock expiry', done => {
    const hashPair = newSecretHashPair()
    HashedTimelock.deployed().then(htlc =>
      htlc
        .newContract(receiver, hashPair.hash, timeLock1Hour, {
          from: sender,
          value: oneFinney,
        })
        .then(newContractTx => {
          const contractId = txContractId(newContractTx)
          htlc
            .refund(contractId, {from: sender})
            .then(() => assert.fail('expected failure due to timelock'))
            .catch(err => {
              assert.equal(err.message, REQUIRE_FAILED_MSG)
              done()
            })
        })
    )
  })

  it("getContract() returns empty record when contract doesn't exist", async () => {
    const htlc = await HashedTimelock.deployed()
    const contract = await htlc.getContract.call('0xabcdef')
    const sender = contract[0]
    assert.equal(Number(sender), 0)
  })
})
