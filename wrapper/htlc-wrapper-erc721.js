const BaseWrapper = require('./base-wrapper')

/**
 * This wrapper can be used for already deployed contracts sharing the main interfaces of HTLCs.
 */
class HtlcErc721Wrapper extends BaseWrapper {
  /**
   * @param receiverAddress address
   * @param hashlock bytes 32
   * @param timelock uint
   * @param tokenContract address
   * @param tokenId uint
   * @param sender address
   */
  newContract(receiverAddress, hashlock, timelock, tokenContract, tokenId, sender) {
    return this.getContractInstance().then((instance) => {
      return instance.newContract(receiverAddress, hashlock, timelock, tokenContract, tokenId, {
        from: sender,
      })
    })
  }
}

module.exports = HtlcErc721Wrapper
