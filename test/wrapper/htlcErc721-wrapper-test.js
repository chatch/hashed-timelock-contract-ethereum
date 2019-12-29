const HtlcWrapperErc721 = require('../../wrapper/htlc-wrapper-erc721')

const {assertEqualBN} = require('../helper/assert')
const {
  htlcERC20ArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  txLoggedArgs,
} = require('../helper/utils')

const HashedTimelockERC721 = artifacts.require('./HashedTimelockERC721.sol')
const AliceERC721 = artifacts.require('./helper/AliceERC721.sol')

// some testing data
const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds

contract('HashedTimelockErc721Wrapper', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]
  const tokenSupply = 1000
  const provider = new web3.providers.HttpProvider("http://localhost:7545");

  let htlcWrapper
  let token

  const assertTokenBal = async (token, addr, tokenAmount, msg) => {
    assertEqualBN(
      await token.balanceOf.call(addr),
      tokenAmount,
      msg ? msg : 'wrong token balance'
    )
  }

  before(async () => {
    htlcWrapper = new HtlcWrapperErc721(HashedTimelockERC721, provider, null);
    let address = await HashedTimelockERC721.new()
    htlcWrapper.setAddress(address.address)
    token = await AliceERC721.new(tokenSupply)
    await token.mint(sender, 1)
    await assertTokenBal(
      token,
      sender,
      1,
      'balance not transferred to Alice in before()'
    )
  })

  it('newContract() in wrapper should create new contract and store correct details', async () => {
    const hashPair = newSecretHashPair()
    await token.approve(htlcWrapper.address, 1, {from: sender})
    const newContractTx = await  htlcWrapper.newContract(
      receiver,
      hashPair.hash,
      timeLock1Hour,
      token.address,
      1,
      sender
    )

    // check event logs
    const logArgs = txLoggedArgs(newContractTx)

    const contractId = logArgs.contractId
    assert(isSha256Hash(contractId))

    assert.equal(logArgs.sender, sender)
    assert.equal(logArgs.receiver, receiver)
    assert.equal(logArgs.tokenContract, token.address)
    assert.equal(logArgs.hashlock, hashPair.hash)
    assert.equal(logArgs.timelock, timeLock1Hour)

    // check htlc record
    const contractArr = await htlcWrapper.getContract(contractId)
    const contract = htlcERC20ArrayToObj(contractArr)
    assert.equal(contract.sender, sender)
    assert.equal(contract.receiver, receiver)
    assert.equal(contract.token, token.address)
    assert.equal(contract.amount.toNumber(), 1)
    assert.equal(contract.hashlock, hashPair.hash)
    assert.equal(contract.timelock.toNumber(), timeLock1Hour)
    assert.isFalse(contract.withdrawn)
    assert.isFalse(contract.refunded)
    assert.equal(
      contract.preimage,
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
  })
})