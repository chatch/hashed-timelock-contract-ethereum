const {assertEqualBN} = require('./helper/assert');
const {
  bufToStr,
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txLoggedArgs,
} = require('./helper/utils');
const promisify = require('util').promisify;
const sleep = promisify(require('timers').setTimeout);
const truffleAssert = require('truffle-assertions');

const HashedTimelockERC721 = artifacts.require('./HashedTimelockERC721.sol')
const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')

const CommodityTokenContract = artifacts.require('./helper/AliceERC721.sol')
const PaymentTokenContract = artifacts.require('./helper/BobERC20.sol')

// some testing data
let timeLock2Sec
const tokenAmount = 5

contract('HashedTimelock swap between ERC721 token and ERC20 token (Delivery vs. Payment)', accounts => {
  // owner of CommodityToken and wants swap for PaymentTokens
  const Alice = accounts[1]
  // owner of PaymentTokens and wants to swap for Token
  const Bob = accounts[2]

  // non-fungible token for tracking goods ownership
  let CommodityTokens
  // fungible token for making payments
  let PaymentTokens

  // HTLC contract for managing swaps in Commodity tokens
  let htlcCommodityTokens
  // HTLC contract for managing swaps in payment tokens
  let htlcPaymentTokens

  // swap contract ID for Commodity delivery Alice -> Bob
  let deliveryContractId
  // swap contract ID for payment Bob -> Alice
  let paymentContractId

  // shared b/w the two swap contracts in both directions
  let hashPair

  // use a variable to track the secret Bob will have learned from Alice's withdraw transaction
  // to make the flow more explicitly reflect the real world sequence of events
  let learnedSecret

  before(async () => {
    htlcCommodityTokens = await HashedTimelockERC721.new()
    htlcPaymentTokens = await HashedTimelockERC20.new()

    CommodityTokens = await CommodityTokenContract.new()
    PaymentTokens = await PaymentTokenContract.new(1000)

    // so Alice has some tokens to trade
    await CommodityTokens.mint(Alice, 1)
    await CommodityTokens.mint(Alice, 2)
    // so Bob has some tokens to make payments
    await PaymentTokens.transfer(Bob, 1000);

    await assertTokenBal(
      CommodityTokens,
      Alice,
      2,
      'Alice should own two Commodity tokens'
    )
    await assertTokenBal(
      CommodityTokens,
      Bob,
      0,
      'Bob should not have any Commodity tokens in before()'
    )
    await assertTokenBal(
      PaymentTokens,
      Bob,
      1000,
      'balance not transferred to Bob in before()'
    )
    await assertTokenBal(
      PaymentTokens,
      Alice,
      0,
      'Alice should not have any payment tokens in before()'
    )

    hashPair = newSecretHashPair()
  })

  // Alice initiates the swap by setting up a transfer of AliceERC721 tokens to Bob
  // she does not need to worry about Bob unilaterally take ownership of the tokens
  // without fulfilling his side of the deal, because this transfer is locked by a hashed secret
  // that only Alice knows at this point
  it('Step 1: Alice sets up a swap with Bob to transfer the Commodity token #1', async () => {
    timeLock2Sec = nowSeconds() + 2
    const newSwapTx = await newSwap(CommodityTokens, 1 /*token id*/, htlcCommodityTokens, {hashlock: hashPair.hash, timelock: timeLock2Sec}, Alice, Bob)
    a2bSwapId = txContractId(newSwapTx)

    // check token balances
    await assertTokenBal(CommodityTokens, Alice, 1, 'Alice has deposited and should have 1 token left');
    await assertTokenBal(CommodityTokens, htlcCommodityTokens.address, 1, 'HTLC should be holding Alice\'s 1 token');
  })

  // // Bob having observed the contract getting set up by Alice in the AliceERC721, now
  // // responds by setting up the corresponding contract in the BobERC721, using the same
  // // hash lock as Alice' side of the deal, so that he can be guaranteed Alice must
  // // disclose the secret to unlock the BobERC721 tokens transfer, and the same secret can then
  // // be used to unlock the AliceERC721 transfer
  it('Step 2: Bob sets up a swap with Alice in the payment contract', async () => {
    // in a real world swap contract, the counterparty's swap timeout period should be shorter
    // but that does not affect the ideal workflow that we are testing here
    timeLock2Sec = nowSeconds() + 2
    const newSwapTx = await newSwap(PaymentTokens, 50, htlcPaymentTokens, {hashlock: hashPair.hash, timelock: timeLock2Sec}, Bob, Alice)
    b2aSwapId = txContractId(newSwapTx)

    // check token balances
    await assertTokenBal(PaymentTokens, Bob, 950, 'Bob has deposited and should have 950 tokens left')
    await assertTokenBal(PaymentTokens, htlcPaymentTokens.address, 50, 'HTLC should be holding Bob\'s 50 tokens')
  })

  it('Step 3: Alice as the initiator withdraws from the BobERC721 with the secret', async () => {
    // Alice has the original secret, calls withdraw with the secret to claim the EU tokens
    await htlcPaymentTokens.withdraw(b2aSwapId, hashPair.secret, {
      from: Alice,
    })

    // Check tokens now owned by Alice
    await assertTokenBal(
      PaymentTokens,
      Alice,
      50,
      `Alice should now own 50 payment tokens`
    )

    const contractArr = await htlcPaymentTokens.getContract.call(b2aSwapId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    // with this the secret is out in the open and Bob will have knowledge of it
    assert.equal(contract.preimage, hashPair.secret)

    learnedSecret = contract.preimage
  })

  it("Step 4: Bob as the counterparty withdraws from the AliceERC721 with the secret learned from Alice's withdrawal", async () => {
    await htlcCommodityTokens.withdraw(a2bSwapId, learnedSecret, {
      from: Bob,
    })

    // Check tokens now owned by Bob
    await assertTokenBal(
      CommodityTokens,
      Bob,
      1,
      `Bob should now own 1 Commodity token`
    )

    const contractArr = await htlcCommodityTokens.getContract.call(a2bSwapId)
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
      let newSwapTx = await newSwap(CommodityTokens, 2 /*token id*/, htlcCommodityTokens, {hashlock: hashPair.hash, timelock: timeLock2Sec}, Alice, Bob)
      a2bSwapId = txContractId(newSwapTx);

      newSwapTx = await newSwap(PaymentTokens, 50, htlcPaymentTokens, {hashlock: hashPair.hash, timelock: timeLock2Sec}, Bob, Alice)
      b2aSwapId = txContractId(newSwapTx)

      await assertTokenBal(CommodityTokens, htlcCommodityTokens.address, 1, 'HTLC should own 1 Commodity token');
      await assertTokenBal(PaymentTokens, htlcPaymentTokens.address, 50, 'HTLC should own 50 payment tokens');

      await sleep(3000);

      // after the timeout expiry Alice calls refund() to get her tokens back
      let result = await htlcCommodityTokens.refund(a2bSwapId, {
        from: Alice
      });

      // verify the event was emitted
      truffleAssert.eventEmitted(result, 'HTLCERC721Refund', ev => {
        return ev.contractId === a2bSwapId;
      }, `Refunded Alice`);

      await assertTokenBal(CommodityTokens, Alice, 1, 'Alice after refund should still have 1 token');

      // Bob can also get his tokens back by calling refund()
      result = await htlcPaymentTokens.refund(b2aSwapId, {
        from: Bob
      });

      // verify the event was emitted
      truffleAssert.eventEmitted(result, 'HTLCERC20Refund', ev => {
        return ev.contractId === b2aSwapId;
      }, `Refunded Bob`);

      await assertTokenBal(PaymentTokens, Bob, 950, 'Bob after refund should still have 950 tokens');
    });
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
});
