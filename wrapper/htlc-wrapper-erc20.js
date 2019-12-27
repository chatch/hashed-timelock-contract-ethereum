const BaseWrapper = require('./base-wrapper')

/**
 * This wrapper can be used for already deployed contracts sharing the main interfaces of HTLCs.
 */
class HtlcErc20Wrapper extends BaseWrapper {
  /**
   * Returns the contract ID.
   * @param receiverAddress address
   * @param hashlock bytes 32
   * @param timelock uint
   * @param tokenContract address
   * @param amount uint
   * @param sender address
   */
  newContract(receiverAddress, hashlock, timelock, tokenContract, amount, sender) {
    return this.getContractInstance().then((instance) => {
      return instance.newContract(receiverAddress, hashlock, timelock, tokenContract, amount, {
        from: sender
      })
    })
  }
}

module.exports = HtlcErc20Wrapper
