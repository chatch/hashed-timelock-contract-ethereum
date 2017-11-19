const crypto = require('crypto')
const Promise = require('bluebird')

// Format required for sending bytes through eth client:
//  - hex string representation
//  - prefixed with 0x
const bufToStr = b => '0x' + b.toString('hex')

const sha256 = x =>
  crypto
    .createHash('sha256')
    .update(x)
    .digest()

const random32 = () => crypto.randomBytes(32)

const isSha256Hash = hashStr => /^0x[0-9a-f]{64}$/i.test(hashStr)

const newSecretHashPair = () => {
  const secret = random32()
  const hash = sha256(secret)
  return {
    secret: bufToStr(secret),
    hash: bufToStr(hash),
  }
}

// fast forward 1 block by sending a useless transaction
const fastForward = async web3 => {
  web3.eth.sendTransactionAsync = Promise.promisify(web3.eth.sendTransaction)
  await web3.eth.sendTransactionAsync({
    from: web3.eth.accounts[8],
    to: web3.eth.accounts[9],
    value: 1,
  })
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

const gasPrice = 100000000000 // truffle fixed gas price
const txGas = txReceipt => txReceipt.receipt.gasUsed * gasPrice
const txLoggedArgs = txReceipt => txReceipt.logs[0].args
const txContractId = txReceipt => txLoggedArgs(txReceipt).contractId

export {
  bufToStr,
  fastForward,
  isSha256Hash,
  newSecretHashPair,
  nowSeconds,
  random32,
  sha256,
  txContractId,
  txGas,
  txLoggedArgs,
}
