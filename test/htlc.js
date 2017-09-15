const crypto = require('crypto')
const HashedTimelock = artifacts.require('./HashedTimelock.sol')

// pre Metropolis failed require() gives invalid opcode
const REQUIRE_FAILED_MSG =
  'VM Exception while processing transaction: invalid opcode'

const hourMillis = 3600 * 1000
const timeLock1Hour = Date.now() + hourMillis
const oneFinney = web3.toWei(1, 'finney')

const sha256 = x =>
  crypto.createHash('sha256').update(x).digest().toString('hex')
const isShaHash = hashStr => /^0x[0-9a-f]{64}$/i.test(hashStr)
const newSecretHashPair = () => {
  const secret = crypto.randomBytes(32).toString('hex')
  return {
    secret: '0x' + secret,
    hash: '0x' + sha256(secret),
  }
}

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
          const contractId = txReceipt.receipt.logs[0].data
          assert(isShaHash(contractId))
          return htlc.getContract.call(contractId)
        })
        .then(contract => {
          assert.equal(contract[0], sender)
          assert.equal(contract[1], receiver)
          assert.equal(contract[2], oneFinney)
          assert.equal(contract[3], hashPair.hash)
          assert.equal(contract[4], timeLock1Hour)
          assert.isFalse(contract[5])
          assert.isFalse(contract[6])
          done()
        })
    )
  })
})
