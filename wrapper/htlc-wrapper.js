import {BaseWrapper} from "./base-wrapper"

/**
 * This wrapper can be used for already deployed contracts sharing the main interfaces of HTLCs.
 */
export class HtlcWrapper extends BaseWrapper {
  /**
   * Returns the contract ID.
   * @param receiverAddress address
   * @param hashlock bytes 32
   * @param timelock uint
   */
  newContract(receiverAddress, hashlock, timelock) {
    return this.getContractInstance().then((instance) => {
      return instance.newContract(receiverAddress, hashlock, timelock);
    })
  }
}
