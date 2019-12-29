const HtlcWrapper = require('../../wrapper/htlc-wrapper')

const {assertEqualBN} = require('../helper/assert')
const {
  getBalance,
  htlcArrayToObj,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  txContractId,
  txGas,
  txLoggedArgs,
} = require('../helper/utils')

const HashedTimelock = artifacts.require('./HashedTimelock.sol')

const hourSeconds = 3600
const timeLock1Hour = nowSeconds() + hourSeconds
const oneFinney = web3.utils.toWei(web3.utils.toBN(1), 'finney')

contract('HashedTimelockWrapper', accounts => {
  const sender = accounts[1]
  const receiver = accounts[2]
  const provider = new web3.providers.HttpProvider("http://localhost:7545");

  it('newContract() and getContract() in wrapper should create new contract and store correct details', async () => {
    const hashPair = newSecretHashPair()
    const htlcWrapper = new HtlcWrapper(HashedTimelock, provider, null)
    const txReceipt = await htlcWrapper.newContract(
      receiver,
      hashPair.hash,
      timeLock1Hour,
      sender,
      oneFinney
    )
    const logArgs = txLoggedArgs(txReceipt)

    const contractId = logArgs.contractId
    assert(isSha256Hash(contractId))

    assert.equal(logArgs.sender, sender)
    assert.equal(logArgs.receiver, receiver)
    assertEqualBN(logArgs.amount, oneFinney)
    assert.equal(logArgs.hashlock, hashPair.hash)
    assert.equal(logArgs.timelock, timeLock1Hour)

    const contractArr = await htlcWrapper.getContract(contractId)
    const contract = htlcArrayToObj(contractArr)
    assert.equal(contract.sender, sender)
    assert.equal(contract.receiver, receiver)
    assertEqualBN(contract.amount, oneFinney)
    assert.equal(contract.hashlock, hashPair.hash)
    assert.equal(contract.timelock.toNumber(), timeLock1Hour)
    assert.isFalse(contract.withdrawn)
    assert.isFalse(contract.refunded)
    assert.equal(
      contract.preimage,
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
  })

  it('withdraw() contract in wrapper should withdraw amount correctly', async () => {
    const hashPair = newSecretHashPair()
    const htlcWrapper = new HtlcWrapper(HashedTimelock, provider, null)
    const newContractTx = await htlcWrapper.newContract(
      receiver,
      hashPair.hash,
      timeLock1Hour,
      sender,
      oneFinney
    )

    const contractId = txContractId(newContractTx)
    const receiverBalBefore = await getBalance(receiver)

    // receiver calls withdraw with the secret to get the funds
    const withdrawTx = await htlcWrapper.withdraw(contractId, hashPair.secret, receiver)
    const tx = await web3.eth.getTransaction(withdrawTx.tx)

    // Check contract funds are now at the receiver address
    const expectedBal = receiverBalBefore
      .add(oneFinney)
      .sub(txGas(withdrawTx, tx.gasPrice))
    assertEqualBN(
      await getBalance(receiver),
      expectedBal,
      "receiver balance doesn't match"
    )
    const contractArr = await htlcWrapper.getContract(contractId)
    const contract = htlcArrayToObj(contractArr)
    assert.isTrue(contract.withdrawn) // withdrawn set
    assert.isFalse(contract.refunded) // refunded still false
    assert.equal(contract.preimage, hashPair.secret)
  })

  it('refund() in wrapper should pass after timelock expiry', async () => {
    const hashPair = newSecretHashPair()
    const htlcWrapper = new HtlcWrapper(HashedTimelock, provider, null)
    const timelock1Second = nowSeconds() + 1

    const newContractTx = await htlcWrapper.newContract(
      receiver,
      hashPair.hash,
      timelock1Second,
      sender,
      oneFinney
    )
    const contractId = txContractId(newContractTx)

    // wait one second so we move past the timelock time
    return new Promise((resolve, reject) =>
      setTimeout(async () => {
        try {
          const balBefore = await getBalance(sender)
          const refundTx = await htlcWrapper.refund(contractId, sender)
          const tx = await web3.eth.getTransaction(refundTx.tx)
          // Check contract funds are now at the senders address
          const expectedBal = balBefore.add(oneFinney).sub(txGas(refundTx, tx.gasPrice))
          assertEqualBN(
            await getBalance(sender),
            expectedBal,
            "sender balance doesn't match"
          )
          const contract = await htlcWrapper.getContract(contractId)
          assert.isTrue(contract[6]) // refunded set
          assert.isFalse(contract[5]) // withdrawn still false
          resolve()
        } catch (err) {
          reject(err)
        }
      }, 1000)
    )
  })

  it('retrieve contract from address in wrapper', async () => {
    const hashPair = newSecretHashPair()
    const htlcWrapper = new HtlcWrapper(HashedTimelock, provider, null)

    const address = await HtlcWrapper.deployContract(HashedTimelock, null, null)
    htlcWrapper.setAddress(address.address)

    const timelock10Minutes = nowSeconds() + 600

    await htlcWrapper.newContract(
      receiver,
      hashPair.hash,
      timelock10Minutes,
      sender,
      oneFinney
    )
  })
})