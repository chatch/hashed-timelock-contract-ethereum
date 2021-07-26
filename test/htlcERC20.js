const {assertEqualBN} = require('./helper/assert')
const {
  bufToStr,
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txLoggedArgs,
} = require('./helper/utils')

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const AliceERC20 = artifacts.require('./helper/AliceERC20.sol')

const REQUIRE_FAILED_MSG = 'Returned error: VM Exception while processing transaction: revert'

// some testing data
const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const tokenAmount = 5

contract('HashedTimelockERC20', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]
  const tokenSupply = 1000
  const senderInitialBalance = 100

  let htlc
  let token

  const assertTokenBal = async (addr, tokenAmount, msg) =>
    assertEqualBN(
      await token.balanceOf.call(addr),
      tokenAmount,
      msg ? msg : 'wrong token balance'
    )

  before(async () => {
    htlc = await HashedTimelockERC20.new()
    token = await AliceERC20.new(tokenSupply)
    await token.transfer(sender, senderInitialBalance)
    await assertTokenBal(
      sender,
      senderInitialBalance,
      'balance not transferred in before()'
    )
  })

  it('newContract() should create new contract and store correct details', async () => {
    const hashPair = newSecretHashPair()
    const newContractTx = await newContract({
      hashlock: hashPair.hash,
    })

    // check token balances
    assertTokenBal(sender, senderInitialBalance - tokenAmount)
    assertTokenBal(htlc.address, tokenAmount)

    // check event logs
    const logArgs = txLoggedArgs(newContractTx)

    const contractId = logArgs.contractId
    assert(isSha256Hash(contractId))

    assert.equal(logArgs.sender, sender)
    assert.equal(logArgs.receiver, receiver)
    assert.equal(logArgs.tokenContract, token.address)
    assert.equal(logArgs.amount.toNumber(), tokenAmount)
    assert.equal(logArgs.hashlock, hashPair.hash)
    assert.equal(logArgs.timelock, timeLock1Hour)

    // check htlc record
    const contractArr = await htlc.getContract.call(contractId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.equal(contract.sender, sender)
    assert.equal(contract.receiver, receiver)
    assert.equal(contract.token, token.address)
    assert.equal(contract.amount.toNumber(), tokenAmount)
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
    await token.approve(htlc.address, 0, {from: sender}) // ensure 0
    await newContractExpectFailure('expected failure due to no tokens approved')
  })

  it('newContract() should fail when token amount is 0', async () => {
    // approve htlc for one token but send amount as 0
    await token.approve(htlc.address, 1, {from: sender})
    await newContractExpectFailure('expected failure due to 0 token amount', {
      amount: 0,
    })
  })

  it('newContract() should fail when tokens approved for some random account', async () => {
    // approve htlc for different account to the htlc contract
    await token.approve(htlc.address, 0, {from: sender}) // ensure 0
    await token.approve(accounts[9], tokenAmount, {from: sender})
    await newContractExpectFailure('expected failure due to wrong approval')
  })

  it('newContract() should fail when the timelock is in the past', async () => {
    const pastTimelock = nowSeconds() - 2
    await token.approve(htlc.address, tokenAmount, {from: sender})
    await newContractExpectFailure(
      'expected failure due to timelock in the past',
      {timelock: pastTimelock}
    )
  })

  it('newContract() should reject a duplicate contract request', async () => {
    const hashlock = newSecretHashPair().hash
    const timelock = timeLock1Hour + 5
    const balBefore = web3.utils.toBN(await token.balanceOf(htlc.address))

    await newContract({hashlock: hashlock, timelock: timelock})
    await assertTokenBal(
      htlc.address,
      balBefore.add(web3.utils.toBN(tokenAmount)),
      'tokens not transfered to htlc contract'
    )

    await token.approve(htlc.address, tokenAmount, {from: sender})
    // now attempt to create another with the exact same parameters
    await newContractExpectFailure(
      'expected failure due to duplicate contract details',
      {
        timelock: timelock,
        hashlock: hashlock,
      }
    )
  })

  it('withdraw() should send receiver funds when given the correct secret preimage', async () => {
    const hashPair = newSecretHashPair()
    const newContractTx = await newContract({hashlock: hashPair.hash})
    const contractId = txContractId(newContractTx)

    // receiver calls withdraw with the secret to claim the tokens
    await htlc.withdraw(contractId, hashPair.secret, {
      from: receiver,
    })

    // Check tokens now owned by the receiver
    await assertTokenBal(
      receiver,
      tokenAmount,
      `receiver doesn't own ${tokenAmount} tokens`
    )

    const contractArr = await htlc.getContract.call(contractId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    assert.equal(contract.preimage, hashPair.secret)
  })

  it('withdraw() should fail if preimage does not hash to hashX', async () => {
    const newContractTx = await newContract({})
    const contractId = txContractId(newContractTx)

    // receiver calls withdraw with an invalid secret
    const wrongSecret = bufToStr(random32())
    try {
      await htlc.withdraw(contractId, wrongSecret, {from: receiver})
      assert.fail('expected failure due to 0 value transferred')
    } catch (err) {
      assert.include(err.message, "hashlock hash does not match")
    }
  })

  it('withdraw() should fail if caller is not the receiver ', async () => {
    const hashPair = newSecretHashPair()
    await token.approve(htlc.address, tokenAmount, {from: sender})
    const newContractTx = await newContract({
      hashlock: hashPair.hash,
    })
    const contractId = txContractId(newContractTx)
    const someGuy = accounts[4]
    try {
      await htlc.withdraw(contractId, hashPair.secret, {from: someGuy})
      assert.fail('expected failure due to wrong receiver')
    } catch (err) {
      assert.include(err.message, "withdrawable: not receiver")
    }
  })

  // it('withdraw() should fail after timelock expiry', async () => {
  //   const hashPair = newSecretHashPair()
  //   const curBlock = await web3.eth.getBlock('latest')
  //   const timelock2Seconds = curBlock.timestamp + 2

  //   const newContractTx = await newContract({
  //     hashlock: hashPair.hash,
  //     timelock: timelock2Seconds,
  //   })
  //   const contractId = txContractId(newContractTx)

  //   // wait one second so we move past the timelock time
  //   return new Promise((resolve, reject) => {
  //     setTimeout(async () => {
  //       // attempt to withdraw and check that it is not allowed
  //       try {
  //         await htlc.withdraw(contractId, hashPair.secret, {from: receiver})
  //         reject(
  //           new Error('expected failure due to withdraw after timelock expired')
  //         )
  //       } catch (err) {
  //         assert.isTrue(err.message.startsWith(REQUIRE_FAILED_MSG))
  //         resolve({message: 'success'})
  //       }
  //     }, 2000)
  //   })
  // })

  // Remove skip if using timelock guard (currently commented out)
  it.skip('refund() should pass after timelock expiry', async () => {
    const hashPair = newSecretHashPair()
    const curBlock = await web3.eth.getBlock('latest')
    const timelock2Seconds = curBlock.timestamp + 2

    await token.approve(htlc.address, tokenAmount, {from: sender})
    const newContractTx = await newContract({
      timelock: timelock2Seconds,
      hashlock: hashPair.hash,
    })
    const contractId = txContractId(newContractTx)

    // wait one second so we move past the timelock time
    return new Promise((resolve, reject) =>
      setTimeout(async () => {
        // attempt to get the refund now we've moved past the timelock time
        const balBefore = await token.balanceOf(sender)
        await htlc.refund(contractId, {from: sender})

        // Check tokens returned to the sender
        await assertTokenBal(
          sender,
          balBefore.add(web3.utils.toBN(tokenAmount)),
          `sender balance unexpected`
        )

        const contractArr = await htlc.getContract.call(contractId)
        const contract = htlcERC20ArrayToObj(contractArr)
        assert.isTrue(contract.refunded)
        assert.isFalse(contract.withdrawn)
      }, 2000)
    )
  })

  // Remove skip if using timelock guard (currently commented out)
  it.skip('refund() should fail before the timelock expiry', async () => {
    const newContractTx = await newContract()
    const contractId = txContractId(newContractTx)
    try {
      await htlc.refund(contractId, {from: sender})
      assert.fail('expected failure due to timelock')
    } catch (err) {
      assert.include(err.message, "refundable: timelock not yet passed")
    }
  })

  it('withdraw() should fail after refund', async () => {
    const hashPair1 = newSecretHashPair()
    const hashPair2 = newSecretHashPair()
    const curBlock = await web3.eth.getBlock('latest')
    const timelock2Seconds = curBlock.timestamp + 2

    await token.approve(htlc.address, tokenAmount * 2, {from: sender})
    const newContractTx1 = await newContract({
      timelock: timelock2Seconds,
      hashlock: hashPair1.hash,
    })
    const contractId1 = txContractId(newContractTx1)
    // create a second contract so there is double the tokens held by the HTLC
    await newContract({
      timelock: timelock2Seconds,
      hashlock: hashPair2.hash,
    })

    // wait one second so we move past the timelock time
    return new Promise((resolve, reject) =>
      setTimeout(async () => {
        // attempt to get the refund now we've moved past the timelock time
        await htlc.refund(contractId1, {from: sender})

        // attempt to withdraw after a already refunded
        try {
          await htlc.withdraw(contractId1, hashPair1.secret, {from: receiver})
          assert.fail('expected failure as already refunded')
        } catch (err) {
          assert.include(err.message, "withdrawable: already refunded")
          resolve()
        }
      }, 2000)
    )
  })

  it("getContract() returns empty record when contract doesn't exist", async () => {
    const htlc = await HashedTimelockERC20.deployed()
    const contract = await htlc.getContract.call('0xabcdef')
    const sender = contract[0]
    assert.equal(Number(sender), 0)
  })

  /*
   * Helper for newContract() calls, does the ERC20 approve before calling
   */
  const newContract = async ({
                               timelock = timeLock1Hour,
                               hashlock = newSecretHashPair().hash,
                             } = {}) => {
    await token.approve(htlc.address, tokenAmount, {from: sender})
    return htlc.newContract(
      receiver,
      hashlock,
      timelock,
      token.address,
      tokenAmount,
      {
        from: sender,
      }
    )
  }

  /*
   * Helper for newContract() when expecting failure
   */
  const newContractExpectFailure = async (
    shouldFailMsg,
    {
      receiverAddr = receiver,
      amount = tokenAmount,
      timelock = timeLock1Hour,
      hashlock = newSecretHashPair().hash
    } = {}
  ) => {
    try {
      await htlc.newContract(
        receiverAddr,
        hashlock,
        timelock,
        token.address,
        amount,
        {
          from: sender,
        }
      )
      assert.fail(shouldFailMsg)
    } catch (err) {
      assert.isTrue(err.message.startsWith(REQUIRE_FAILED_MSG))
    }
  }
})
