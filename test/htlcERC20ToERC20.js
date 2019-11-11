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

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const AliceERC20TokenContract = artifacts.require('./helper/AliceERC20.sol')
const BobERC20TokenContract = artifacts.require('./helper/BobERC20.sol')

// some testing data
let timeLockSeconds
const tokenAmount = 5

contract('HashedTimelock swap between two ERC20 tokens', accounts => {
  const Alice = accounts[1] // owner of AliceERC20 and wants swap for BobERC20
  const Bob = accounts[2] // owner of BobERC20 and wants to swap for AliceERC20

  const tokenSupply = 1000
  const senderInitialBalance = 100

  let htlc
  let AliceERC20
  let BobERC20
  let hashPair // shared b/w the two swap contracts in both directions
  let a2bSwapId // swap contract ID for Alice -> Bob in the AliceERC20
  let b2aSwapId // swap contract ID for Bob -> Alice in the BobERC20
  // use a variable to track the secret Bob will have learned from Alice's withdraw transaction
  // to make the flow more explicitly reflect the real world sequence of events
  let learnedSecret

  before(async () => {
    // if both tokens run on the same chain, they can share the HTLC contract to
    // coordinate the swap. They can also use separate instances on the same chain,
    // or even separate instances on different chains.
    // The key is the HTLC contract must be running on the same chain
    // that the target Token to be transferred between the two counterparties runs on
    htlc = await HashedTimelockERC20.new()

    AliceERC20 = await AliceERC20TokenContract.new(tokenSupply)
    BobERC20 = await BobERC20TokenContract.new(tokenSupply)
    await AliceERC20.transfer(Alice, senderInitialBalance) // so Alice has some tokens to trade
    await BobERC20.transfer(Bob, senderInitialBalance) // so Bob has some tokens to trade

    await assertTokenBal(
      AliceERC20,
      Alice,
      senderInitialBalance,
      'balance not transferred to Alice in before()'
    )
    await assertTokenBal(
      AliceERC20,
      Bob,
      0,
      'Bob should not have any AliceERC20 tokens in before()'
    )
    await assertTokenBal(
      BobERC20,
      Bob,
      senderInitialBalance,
      'balance not transferred to Bob in before()'
    )
    await assertTokenBal(
      BobERC20,
      Alice,
      0,
      'Alice should not have any BobERC20 tokens in before()'
    )

    hashPair = newSecretHashPair()
  })

  // Alice initiates the swap by setting up a transfer of AliceERC20 tokens to Bob
  // she does not need to worry about Bob unilaterally take ownership of the tokens
  // without fulfilling his side of the deal, because this transfer is locked by a hashed secret
  // that only Alice knows at this point
  it('Step 1: Alice sets up a swap with Bob in the AliceERC20 contract', async () => {
    timeLockSeconds = nowSeconds() + 2
    const newSwapTx = await newSwap(AliceERC20, htlc, {hashlock: hashPair.hash, timelock: timeLockSeconds}, Alice, Bob)
    a2bSwapId = txContractId(newSwapTx)

    // check token balances
    await assertTokenBal(AliceERC20, Alice, senderInitialBalance - tokenAmount)
    await assertTokenBal(AliceERC20, htlc.address, tokenAmount)
  })

  // Bob having observed the contract getting set up by Alice in the AliceERC20, now
  // responds by setting up the corresponding contract in the BobERC20, using the same
  // hash lock as Alice' side of the deal, so that he can be guaranteed Alice must
  // disclose the secret to unlock the BobERC20 tokens transfer, and the same secret can then
  // be used to unlock the AliceERC20 transfer
  it('Step 2: Bob sets up a swap with Alice in the BobERC20 contract', async () => {
    // in a real world swap contract, the counterparty's swap timeout period should be shorter
    // but that does not affect the ideal workflow that we are testing here
    timeLockSeconds = nowSeconds() + 2
    const newSwapTx = await newSwap(BobERC20, htlc, {hashlock: hashPair.hash, timelock: timeLockSeconds}, Bob, Alice)
    b2aSwapId = txContractId(newSwapTx)

    // check token balances
    await assertTokenBal(BobERC20, Bob, senderInitialBalance - tokenAmount)
    await assertTokenBal(BobERC20, htlc.address, tokenAmount)
  })

  it('Step 3: Alice as the initiator withdraws from the BobERC20 with the secret', async () => {
    // Alice has the original secret, calls withdraw with the secret to claim the EU tokens
    await htlc.withdraw(b2aSwapId, hashPair.secret, {
      from: Alice,
    })

    // Check tokens now owned by Alice
    await assertTokenBal(
      BobERC20,
      Alice,
      tokenAmount,
      `Alice doesn't not own ${tokenAmount} tokens`
    )

    const contractArr = await htlc.getContract.call(b2aSwapId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    // with this the secret is out in the open and Bob will have knowledge of it
    assert.equal(contract.preimage, hashPair.secret)

    learnedSecret = contract.preimage
  })

  it("Step 4: Bob as the counterparty withdraws from the AliceERC20 with the secret learned from Alice's withdrawal", async () => {
    await htlc.withdraw(a2bSwapId, learnedSecret, {
      from: Bob,
    })

    // Check tokens now owned by Bob
    await assertTokenBal(
      AliceERC20,
      Bob,
      tokenAmount,
      `Bob doesn't not own ${tokenAmount} tokens`
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
    const currentBalanceAlice = senderInitialBalance - tokenAmount;
    const currentBalanceBob = senderInitialBalance - tokenAmount;

    it('the swap is set up with 5sec timeout on both sides', async () => {
      timeLockSeconds = nowSeconds() + 3
      let newSwapTx = await newSwap(AliceERC20, htlc, {hashlock: hashPair.hash, timelock: timeLockSeconds}, Alice, Bob)
      a2bSwapId = txContractId(newSwapTx);

      newSwapTx = await newSwap(BobERC20, htlc, {hashlock: hashPair.hash, timelock: timeLockSeconds}, Bob, Alice)
      b2aSwapId = txContractId(newSwapTx)

      await assertTokenBal(AliceERC20, htlc.address, tokenAmount);
      await assertTokenBal(BobERC20, htlc.address, tokenAmount);

      await sleep(3000);

      // after the timeout expiry Alice calls refund() to get her tokens back
      let result = await htlc.refund(a2bSwapId, {
        from: Alice
      });

      // verify the event was emitted
      truffleAssert.eventEmitted(result, 'HTLCERC20Refund', ev => {
        return ev.contractId === a2bSwapId;
      }, `Refunded Alice`);

      await assertTokenBal(AliceERC20, Alice, currentBalanceAlice);

      // Bob can also get his tokens back by calling refund()
      result = await htlc.refund(b2aSwapId, {
        from: Bob
      });

      // verify the event was emitted
      truffleAssert.eventEmitted(result, 'HTLCERC20Refund', ev => {
        return ev.contractId === b2aSwapId;
      }, `Refunded Bob`);

      await assertTokenBal(BobERC20, Bob, currentBalanceBob);
    });
  })

  const newSwap = async (token, htlc, config, initiator, counterparty) => {
    // initiator of the swap has to first designate the swap contract as a spender of his/her money
    // with allowance matching the swap amount
    await token.approve(htlc.address, tokenAmount, {from: initiator})
    return htlc.newContract(
      counterparty,
      config.hashlock,
      config.timelock,
      token.address,
      tokenAmount,
      {
        from: initiator,
      }
    )
  }
});
