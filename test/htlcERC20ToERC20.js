import {assertEqualBN} from './helper/assert'
import {
  bufToStr,
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  txContractId,
  txLoggedArgs,
} from './helper/utils'

const HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')
const ASEANTokenContract = artifacts.require('./helper/ASEANToken.sol')
const EUTokenContract = artifacts.require('./helper/EUToken.sol')

// some testing data
const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const tokenAmount = 5

contract('HashedTimelock swap between two ERC20 tokens', accounts => {
  const Alice = accounts[1] // owner of ASEANToken and wants swap for EUToken
  const Bob = accounts[2] // owner of EUToken and wants to swap for ASEANToken

  const tokenSupply = 1000
  const senderInitialBalance = 100

  let htlcAliceToBob
  let htlcBobToAlice
  let ASEANToken
  let EUToken
  let hashPair // shared b/w the two swap contracts in both directions
  let a2bSwapId // swap contract ID for Alice -> Bob in the ASEANToken
  let b2aSwapId // swap contract ID for Bob -> Alice in the EUToken
  // use a variable to track the secret Bob will have learned from Alice's withdraw transaction
  // to make the flow more explicitly reflect the real world sequence of events
  let learnedSecret

  before(async () => {
    htlcAliceToBob = await HashedTimelockERC20.new()
    htlcBobToAlice = await HashedTimelockERC20.new()

    ASEANToken = await ASEANTokenContract.new(tokenSupply)
    EUToken = await EUTokenContract.new(tokenSupply)
    await ASEANToken.transfer(Alice, senderInitialBalance) // so Alice has some tokens to trade
    await EUToken.transfer(Bob, senderInitialBalance) // so Bob has some tokens to trade

    await assertTokenBal(
      ASEANToken,
      Alice,
      senderInitialBalance,
      'balance not transferred to Alice in before()'
    )
    await assertTokenBal(
      ASEANToken,
      Bob,
      0,
      'Bob should not have any ASEANTokens in before()'
    )
    await assertTokenBal(
      EUToken,
      Bob,
      senderInitialBalance,
      'balance not transferred to Bob in before()'
    )
    await assertTokenBal(
      EUToken,
      Alice,
      0,
      'Alice should not have any EUTokens in before()'
    )

    hashPair = newSecretHashPair()
  })

  it('Step 1: Alice sets up a swap with Bob in the ASEANToken contract', async () => {
    const newSwapTx = await newSwap(ASEANToken, htlcAliceToBob, {hashlock: hashPair.hash, timelock: timeLock1Hour}, Alice, Bob)
    a2bSwapId = txContractId(newSwapTx)

    // check token balances
    assertTokenBal(ASEANToken, Alice, senderInitialBalance - tokenAmount)
    assertTokenBal(ASEANToken, htlcAliceToBob.address, tokenAmount)
  })

  it('Step 2: Bob sets up a swap with Alice in the EUToken contract', async () => {
    // in a real world swap contract, the counterparty's swap timeout period should be shorter
    // but that does not affect the ideal workflow that we are testing here
    const newSwapTx = await newSwap(EUToken, htlcBobToAlice, {hashlock: hashPair.hash, timelock: timeLock1Hour}, Bob, Alice)
    b2aSwapId = txContractId(newSwapTx)

    // check token balances
    assertTokenBal(EUToken, Bob, senderInitialBalance - tokenAmount)
    assertTokenBal(EUToken, htlcBobToAlice.address, tokenAmount)
  })

  it('Step 3: Alice as the initiator withdraws from the EUToken with the secret', async () => {
    // Alice has the original secret, calls withdraw with the secret to claim the EU tokens
    await htlcBobToAlice.withdraw(b2aSwapId, hashPair.secret, {
      from: Alice,
    })

    // Check tokens now owned by Alice
    await assertTokenBal(
      EUToken,
      Alice,
      tokenAmount,
      `Alice doesn't not own ${tokenAmount} tokens`
    )

    const contractArr = await htlcBobToAlice.getContract.call(b2aSwapId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    // with this the secret is out in the open and Bob will have knowledge of it
    assert.equal(contract.preimage, hashPair.secret)

    learnedSecret = contract.preimage
  })

  it("Step 4: Bob as the counterparty withdraws from the ASEANToken with the secret learned from Alice's withdrawal", async () => {
    await htlcAliceToBob.withdraw(a2bSwapId, learnedSecret, {
      from: Bob,
    })

    // Check tokens now owned by Bob
    await assertTokenBal(
      ASEANToken,
      Bob,
      tokenAmount,
      `Bob doesn't not own ${tokenAmount} tokens`
    )

    const contractArr = await htlcAliceToBob.getContract.call(a2bSwapId)
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
