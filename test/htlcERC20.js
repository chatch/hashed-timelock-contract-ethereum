import {
  bufToStr,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txGas,
  txLoggedArgs,
} from './helper/utils'

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const ASEANToken = artifacts.require('./helper/ASEANToken.sol')

// pre Metropolis failed require() gives invalid opcode
const REQUIRE_FAILED_MSG =
  'VM Exception while processing transaction: invalid opcode'

const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds

const contractArrToObj = c => {
  return {
    sender: c[0],
    receiver: c[1],
    token: c[2],
    amount: c[3],
    hashlock: c[4],
    timelock: c[5],
    withdrawn: c[6],
    refunded: c[7],
    preimage: c[8],
  }
}

/*
 * Helper for the newContract() should fail tests
 */
const newContractExpectFailure = async (
  shouldFailMsg,
  htlc,
  receiver,
  sender,
  tokenAddr,
  amount,
  timelock = timeLock1Hour,
  hashlock = newSecretHashPair().hash
) => {
  try {
    await htlc.newContract(receiver, hashlock, timelock, tokenAddr, amount, {
      from: sender,
    })
    assert.fail(shouldFailMsg)
  } catch (err) {
    assert.equal(err.message, REQUIRE_FAILED_MSG)
  }
}

contract('HashedTimelockERC20', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]
  const tokenSupply = 1000
  const senderInitialBalance = 100

  const assertTokenBal = async (addr, amount, msg) =>
    assert.equal(
      (await token.balanceOf.call(addr)).toNumber(),
      amount,
      msg ? msg : 'balance wrong'
    )

  let htlc
  let token

  before(async () => {
    htlc = await HashedTimelockERC20.new()
    token = await ASEANToken.new(tokenSupply)
    await token.transfer(sender, senderInitialBalance)
    assertTokenBal(
      sender,
      senderInitialBalance,
      'balance not transferred in before()'
    )
  })

  it('newContract() should create new contract and store correct details', async () => {
    const amount = 5
    const hashPair = newSecretHashPair()

    await token.approve(htlc.address, amount, {from: sender})

    const receipt = await htlc.newContract(
      receiver,
      hashPair.hash,
      timeLock1Hour,
      token.address,
      amount,
      {
        from: sender,
      }
    )

    // check token balances
    assertTokenBal(sender, senderInitialBalance - amount)
    assertTokenBal(htlc.address, amount)

    // check event logs
    const logArgs = txLoggedArgs(receipt)

    const contractId = logArgs.contractId
    assert(isSha256Hash(contractId))

    assert.equal(logArgs.sender, sender)
    assert.equal(logArgs.receiver, receiver)
    assert.equal(logArgs.token, token.address)
    assert.equal(logArgs.amount.toNumber(), amount)
    assert.equal(logArgs.hashlock, hashPair.hash)
    assert.equal(logArgs.timelock, timeLock1Hour)

    // check htlc record
    const contractArr = await htlc.getContract.call(contractId)
    const contract = contractArrToObj(contractArr)
    assert.equal(contract.sender, sender)
    assert.equal(contract.receiver, receiver)
    assert.equal(contract.token, token.address)
    assert.equal(contract.amount.toNumber(), amount)
    assert.equal(contract.hashlock, hashPair.hash)
    assert.equal(contract.timelock.toNumber(), timeLock1Hour)
    assert.isFalse(contract.withdrawn)
    assert.isFalse(contract.refunded)
    assert.equal(
      contract.preimage,
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
  })

  it('newContract() should fail when no token transfer approved', async () => {
    const amount = 1
    await newContractExpectFailure(
      'expected failure due to no tokens approved',
      htlc,
      receiver,
      sender,
      token.address,
      amount
    )
  })

  it('newContract() should fail when token amount is 0', async () => {
    // approve htlc for one token but send amount as 0
    await token.approve(htlc.address, 1, {from: sender})
    await newContractExpectFailure(
      'expected failure due to 0 token amount',
      htlc,
      receiver,
      sender,
      token.address,
      0 // web3.toBigNumber(0)
    )
  })

  it('newContract() should fail when tokens approved for a different account', async () => {
    // approve htlc for different account to the htlc contract
    const amount = 1
    await token.approve(htlc.address, 0, {from: sender})
    await token.approve(accounts[9], amount, {from: sender})
    await newContractExpectFailure(
      'expected failure due to wrong approval',
      htlc,
      receiver,
      sender,
      token.address,
      amount
    )
  })

  it('newContract() should fail when the timelock is in the past', async () => {
    const amount = 1
    const pastTimelock = nowSeconds() - 2
    await token.approve(htlc.address, amount, {from: sender})
    await newContractExpectFailure(
      'expected failure due to timelock in the past',
      htlc,
      receiver,
      sender,
      token.address,
      amount,
      pastTimelock
    )
  })

  it('newContract() should reject a duplicate contract request', async () => {
    const amount = 1
    const hashlock = newSecretHashPair().hash
    const timelock = timeLock1Hour + 5

    const balBefore = await token.balanceOf(htlc.address)
    await token.approve(htlc.address, amount, {from: sender})

    // create 1st contract
    await htlc.newContract(
      receiver,
      hashlock,
      timelock,
      token.address,
      amount,
      {
        from: sender,
      }
    )
    assertTokenBal(
      htlc.address,
      balBefore.plus(amount),
      'tokens transfered to htlc contract'
    )

    // now attempt to create another with the exact same parameters
    await token.approve(htlc.address, amount, {from: sender})
    await newContractExpectFailure(
      'expected failure due to duplicate contract details',
      htlc,
      receiver,
      sender,
      token.address,
      amount,
      timelock,
      hashlock
    )
  })

  // it('withdraw() should send receiver funds when given the correct secret preimage', done => {
  //   const hashPair = newSecretHashPair()
  //   HashedTimelockERC20.deployed().then(htlc =>
  //     htlc
  //       .newContract(receiver, hashPair.hash, timeLock1Hour, {
  //         from: sender,
  //         value: oneFinney,
  //       })
  //       .then(newContractTx => {
  //         const contractId = txContractId(newContractTx)
  //         const receiverBalBefore = web3.eth.getBalance(receiver)
  //
  //         // receiver calls withdraw with the secret to get the funds
  //         htlc
  //           .withdraw(contractId, hashPair.secret, {from: receiver})
  //           .then(withdrawTx => {
  //             // Check contract funds are now at the receiver address
  //             const expectedBal = receiverBalBefore
  //               .plus(oneFinney)
  //               .minus(txGas(withdrawTx))
  //             assert(
  //               web3.eth.getBalance(receiver).equals(expectedBal),
  //               "receiver balance doesn't match"
  //             )
  //             return htlc.getContract.call(contractId)
  //           })
  //           .then(contractArr => {
  //             const contract = contractArrToObj(contractArr)
  //             assert.isTrue(contract.withdrawn) // withdrawn set
  //             assert.isFalse(contract.refunded) // refunded still false
  //             assert.equal(contract.preimage, hashPair.secret)
  //             done()
  //           })
  //       })
  //   )
  // })
  //
  // it('withdraw() should fail if preimage does not hash to hashX', done => {
  //   const hashPair = newSecretHashPair()
  //   HashedTimelockERC20.deployed().then(htlc =>
  //     htlc
  //       .newContract(receiver, hashPair.hash, timeLock1Hour, {
  //         from: sender,
  //         value: oneFinney,
  //       })
  //       .then(newContractTx => {
  //         const contractId = txContractId(newContractTx)
  //
  //         // receiver calls withdraw with an invalid secret
  //         const wrongSecret = bufToStr(random32())
  //         htlc
  //           .withdraw(contractId, wrongSecret, {from: receiver})
  //           .then(() =>
  //             assert.fail('expected failure due to 0 value transferred')
  //           )
  //           .catch(err => {
  //             assert.equal(err.message, REQUIRE_FAILED_MSG)
  //             done()
  //           })
  //       })
  //   )
  // })
  //
  // it('withdraw() should fail if caller is not the receiver ', done => {
  //   const hashPair = newSecretHashPair()
  //   HashedTimelockERC20.deployed().then(htlc =>
  //     htlc
  //       .newContract(receiver, hashPair.hash, timeLock1Hour, {
  //         from: sender,
  //         value: oneFinney,
  //       })
  //       .then(newContractTx => {
  //         const contractId = txContractId(newContractTx)
  //         const someGuy = accounts[4]
  //         htlc
  //           .withdraw(contractId, hashPair.secret, {from: someGuy})
  //           .then(() => assert.fail('expected failure due to wrong receiver'))
  //           .catch(err => {
  //             assert.equal(err.message, REQUIRE_FAILED_MSG)
  //             done()
  //           })
  //       })
  //   )
  // })
  //
  // it('withdraw() should fail after timelock expiry', done => {
  //   const hashPair = newSecretHashPair()
  //   HashedTimelockERC20.deployed().then(htlc => {
  //     const curBlkTime = web3.eth.getBlock('latest').timestamp
  //     const timelock1Second = curBlkTime + 1
  //
  //     htlc
  //       .newContract(receiver, hashPair.hash, timelock1Second, {
  //         from: sender,
  //         value: oneFinney,
  //       })
  //       .then(newContractTx => {
  //         const contractId = txContractId(newContractTx)
  //
  //         // wait one second so we move past the timelock time
  //         setTimeout(() => {
  //           // send an unrelated transaction to move the Solidity 'now' value
  //           // (which equals the time of most recent block) past the locktime.
  //
  //           // NOTE: this tx could be anything just to get a block mined; but
  //           // let's just create another htlc between other accounts and ignore
  //           // the result
  //           htlc
  //             .newContract(accounts[3], bufToStr(random32()), timeLock1Hour, {
  //               from: accounts[4],
  //               value: oneFinney,
  //             })
  //             .then(() => {
  //               // attempt to withdraw and check that it is not allowed
  //               htlc
  //                 .withdraw(contractId, hashPair.secret, {from: receiver})
  //                 .then(() =>
  //                   assert.fail(
  //                     'expected failure due to withdraw after timelock expired'
  //                   )
  //                 )
  //                 .catch(err => {
  //                   assert.equal(err.message, REQUIRE_FAILED_MSG)
  //                   done()
  //                 })
  //             })
  //         }, 1000)
  //       })
  //   })
  // })
  //
  // it('refund() should pass after timelock expiry', done => {
  //   const hashPair = newSecretHashPair()
  //   HashedTimelockERC20.deployed().then(htlc => {
  //     const curBlkTime = web3.eth.getBlock('latest').timestamp
  //     const timelock1Second = curBlkTime + 1
  //
  //     htlc
  //       .newContract(receiver, hashPair.hash, timelock1Second, {
  //         from: sender,
  //         value: oneFinney,
  //       })
  //       .then(newContractTx => {
  //         const contractId = txContractId(newContractTx)
  //
  //         // wait one second so we move past the timelock time
  //         setTimeout(() => {
  //           // send an unrelated transaction to move the Solidity 'now' value
  //           // (which equals the time of most recent block) past the locktime.
  //
  //           // NOTE: this tx could be anything just to get a block mined; but
  //           // let's just create another htlc between other accounts and ignore
  //           // the result
  //           htlc
  //             .newContract(accounts[3], bufToStr(random32()), timeLock1Hour, {
  //               from: accounts[4],
  //               value: oneFinney,
  //             })
  //             .then(() => {
  //               // attempt to get the refund now we've moved past the timelock time
  //               const balBefore = web3.eth.getBalance(sender)
  //               htlc
  //                 .refund(contractId, {from: sender})
  //                 .then(tx => {
  //                   // Check contract funds are now at the senders address
  //                   const expectedBal = balBefore
  //                     .plus(oneFinney)
  //                     .minus(txGas(tx))
  //                   assert(
  //                     web3.eth.getBalance(sender).equals(expectedBal),
  //                     "sender balance doesn't match"
  //                   )
  //                   return htlc.getContract.call(contractId)
  //                 })
  //                 .then(contract => {
  //                   assert.isTrue(contract[6]) // refunded set
  //                   assert.isFalse(contract[5]) // withdrawn still false
  //                   done()
  //                 })
  //                 .catch(err => console.error(`caught error: ${err.message}`))
  //             })
  //             .catch(err => console.error(`caught error 2: ${err.message}`))
  //         }, 2000)
  //       })
  //   })
  // })
  //
  // it('refund() should fail before the timelock expiry', done => {
  //   const hashPair = newSecretHashPair()
  //   HashedTimelockERC20.deployed().then(htlc =>
  //     htlc
  //       .newContract(receiver, hashPair.hash, timeLock1Hour, {
  //         from: sender,
  //         value: oneFinney,
  //       })
  //       .then(newContractTx => {
  //         const contractId = txContractId(newContractTx)
  //         htlc
  //           .refund(contractId, {from: sender})
  //           .then(() => assert.fail('expected failure due to timelock'))
  //           .catch(err => {
  //             assert.equal(err.message, REQUIRE_FAILED_MSG)
  //             done()
  //           })
  //       })
  //   )
  // })
  //
  // it("getContract() returns empty record when contract doesn't exist", async () => {
  //   const htlc = await HashedTimelockERC20.deployed()
  //   const contract = await htlc.getContract.call('0xabcdef')
  //   const sender = contract[0]
  //   assert.equal(Number(sender), 0)
  // })
})
