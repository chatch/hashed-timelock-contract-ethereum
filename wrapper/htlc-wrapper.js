const BaseWrapper = require('./base-wrapper')

/**
 * This wrapper can be used for already deployed contracts sharing the main interfaces of HTLCs.
 */
class HtlcWrapper extends BaseWrapper {
  /**
   * Returns the contract ID.
   * @param receiverAddress address
   * @param hashlock bytes 32
   * @param timelock uint
   * @param sender address
   * @param amount uint
   */
  newContract(receiverAddress, hashlock, timelock, sender, amount) {
    return this.getContractInstance().then((instance) => {
      return instance.newContract(receiverAddress, hashlock, timelock, {
        from: sender,
        value: amount,
      })
    })
  }
}

module.exports = HtlcWrapper
