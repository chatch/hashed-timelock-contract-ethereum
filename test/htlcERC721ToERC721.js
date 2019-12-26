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
const promisify = require('util').promisify
const sleep = promisify(require('timers').setTimeout)
const truffleAssert = require('truffle-assertions')

const HashedTimelockERC721 = artifacts.require('./HashedTimelockERC721.sol')
const AliceERC721TokenContract = artifacts.require('./helper/AliceERC721.sol')
const BobERC721TokenContract = artifacts.require('./helper/BobERC721.sol')

// some testing data
let timeLock2Sec
const tokenAmount = 5

contract('HashedTimelock swap between two ERC721 tokens', accounts => {
  const Alice = accounts[1] // owner of AliceERC721 and wants swap for BobERC721
  const Bob = accounts[2] // owner of BobERC721 and wants to swap for AliceERC721

  let htlc
  let AliceERC721
  let BobERC721
  let hashPair // shared b/w the two swap contracts in both directions
  let a2bSwapId // swap contract ID for Alice -> Bob in the AliceERC721
  let b2aSwapId // swap contract ID for Bob -> Alice in the BobERC721
  // use a variable to track the secret Bob will have learned from Alice's withdraw transaction
  // to make the flow more explicitly reflect the real world sequence of events
  let learnedSecret

  before(async () => {
    // if both tokens run on the same chain, they can share the HTLC contract to
    // coordinate the swap. They can also use separate instances on the same chain,
    // or even separate instances on different chains.
    // The key is the HTLC contract must be running on the same chain
    // that the target Token to be transferred between the two counterparties runs on
    htlc = await HashedTimelockERC721.new()

    AliceERC721 = await AliceERC721TokenContract.new()
    BobERC721 = await BobERC721TokenContract.new()

    await AliceERC721.mint(Alice, 1) // so Alice has some tokens to trade
    await AliceERC721.mint(Alice, 2) // so Alice has some tokens to trade
    await BobERC721.mint(Bob, 1) // so Bob has some tokens to trade
    await BobERC721.mint(Bob, 2) // so Bob has some tokens to trade

    await assertTokenBal(
      AliceERC721,
      Alice,
      2,
      'balance not transferred to Alice in before()'
    )
    await assertTokenBal(
      AliceERC721,
      Bob,
      0,
      'Bob should not have any AliceERC721 tokens in before()'
    )
    await assertTokenBal(
      BobERC721,
      Bob,
      2,
      'balance not transferred to Bob in before()'
    )
    await assertTokenBal(
      BobERC721,
      Alice,
      0,
      'Alice should not have any BobERC721 tokens in before()'
    )

    hashPair = newSecretHashPair()
  })

  // Alice initiates the swap by setting up a transfer of AliceERC721 tokens to Bob
  // she does not need to worry about Bob unilaterally take ownership of the tokens
  // without fulfilling his side of the deal, because this transfer is locked by a hashed secret
  // that only Alice knows at this point
  it('Step 1: Alice sets up a swap with Bob in the AliceERC721 contract', async () => {
    timeLock2Sec = nowSeconds() + 2
    const newSwapTx = await newSwap(AliceERC721, 1 /*token id*/, htlc, {
      hashlock: hashPair.hash,
      timelock: timeLock2Sec
    }, Alice, Bob)
    a2bSwapId = txContractId(newSwapTx)

    // check token balances
    await assertTokenBal(AliceERC721, Alice, 1, 'Alice has deposited and should have 1 token left')
    await assertTokenBal(AliceERC721, htlc.address, 1, 'HTLC should be holding Alice\'s 1 token')
  })

  // // Bob having observed the contract getting set up by Alice in the AliceERC721, now
  // // responds by setting up the corresponding contract in the BobERC721, using the same
  // // hash lock as Alice' side of the deal, so that he can be guaranteed Alice must
  // // disclose the secret to unlock the BobERC721 tokens transfer, and the same secret can then
  // // be used to unlock the AliceERC721 transfer
  it('Step 2: Bob sets up a swap with Alice in the BobERC721 contract', async () => {
    // in a real world swap contract, the counterparty's swap timeout period should be shorter
    // but that does not affect the ideal workflow that we are testing here
    timeLock2Sec = nowSeconds() + 2
    const newSwapTx = await newSwap(BobERC721, 1 /*token id*/, htlc, {
      hashlock: hashPair.hash,
      timelock: timeLock2Sec
    }, Bob, Alice)
    b2aSwapId = txContractId(newSwapTx)

    // check token balances
    await assertTokenBal(BobERC721, Bob, 1, 'Bob has deposited and should have 1 token left')
    await assertTokenBal(BobERC721, htlc.address, 1, 'HTLC should be holding Bob\'s 1 token')
  })

  it('Step 3: Alice as the initiator withdraws from the BobERC721 with the secret', async () => {
    // Alice has the original secret, calls withdraw with the secret to claim the EU tokens
    await htlc.withdraw(b2aSwapId, hashPair.secret, {
      from: Alice,
    })

    // Check tokens now owned by Alice
    await assertTokenBal(
      BobERC721,
      Alice,
      1,
      `Alice should now own 1 Bob token`
    )

    const contractArr = await htlc.getContract.call(b2aSwapId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    // with this the secret is out in the open and Bob will have knowledge of it
    assert.equal(contract.preimage, hashPair.secret)

    learnedSecret = contract.preimage
  })

  it("Step 4: Bob as the counterparty withdraws from the AliceERC721 with the secret learned from Alice's withdrawal", async () => {
    await htlc.withdraw(a2bSwapId, learnedSecret, {
      from: Bob,
    })

    // Check tokens now owned by Bob
    await assertTokenBal(
      AliceERC721,
      Bob,
      1,
      `Bob should now own 1 Alice token`
    )

    const contractArr = await htlc.getContract.call(a2bSwapId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    assert.equal(contract.preimage, learnedSecret)
  })

  const assertTokenBal = async (token, addr, tokenAmount, msg) => {
    assertEqualBN(
      await token.balanceOf.call(addr),
      tokenAmount,
      msg ? msg : 'wrong token balance'
    )
  }

  describe("Test the refund scenario:", () => {
    it('the swap is set up with 5sec timeout on both sides', async () => {
      timeLock2Sec = nowSeconds() + 3
      let newSwapTx = await newSwap(AliceERC721, 2 /*token id*/, htlc, {
        hashlock: hashPair.hash,
        timelock: timeLock2Sec
      }, Alice, Bob)
      a2bSwapId = txContractId(newSwapTx)

      newSwapTx = await newSwap(BobERC721, 2 /*token id*/, htlc, {
        hashlock: hashPair.hash,
        timelock: timeLock2Sec
      }, Bob, Alice)
      b2aSwapId = txContractId(newSwapTx)

      await assertTokenBal(AliceERC721, htlc.address, 1, 'HTLC should own 1 Alice token')
      await assertTokenBal(BobERC721, htlc.address, 1, 'HTLC should own 1 Bob token')

      await sleep(3000)

      // after the timeout expiry Alice calls refund() to get her tokens back
      let result = await htlc.refund(a2bSwapId, {
        from: Alice
      })

      // verify the event was emitted
      truffleAssert.eventEmitted(result, 'HTLCERC721Refund', ev => {
        return ev.contractId === a2bSwapId
      }, `Refunded Alice`)

      await assertTokenBal(AliceERC721, Alice, 1, 'Alice after refund should still have 1 token')

      // Bob can also get his tokens back by calling refund()
      result = await htlc.refund(b2aSwapId, {
        from: Bob
      })

      // verify the event was emitted
      truffleAssert.eventEmitted(result, 'HTLCERC721Refund', ev => {
        return ev.contractId === b2aSwapId
      }, `Refunded Bob`)

      await assertTokenBal(BobERC721, Bob, 1, 'Bob after refund should still have 1 token')
    })
  })

  const newSwap = async (token, tokenId, htlc, config, initiator, counterparty) => {
    // initiator of the swap has to first designate the swap contract as a spender of his/her money
    // with allowance matching the swap amount
    await token.approve(htlc.address, tokenId, {from: initiator})
    return htlc.newContract(
      counterparty,
      config.hashlock,
      config.timelock,
      token.address,
      tokenId,
      {
        from: initiator,
      }
    )
  }
})
