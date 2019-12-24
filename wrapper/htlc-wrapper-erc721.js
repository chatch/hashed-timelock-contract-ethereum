import {BaseWrapper} from "./base-wrapper"

/**
 * This wrapper can be used for already deployed contracts sharing the 3 main interfaces of HTLCs.
 */
export class HtlcErc721Wrapper extends BaseWrapper{
  hashedTimelockContract;

  constructor(contractJson) {
    super(contractJson);
  }

  /**
   * @param receiverAddress address
   * @param hashlock bytes 32
   * @param timelock uint
   * @param tokenContract address
   * @param tokenId uint
   */
  newContract(receiverAddress, hashlock, timelock, tokenContract, tokenId) {
    return this.hashedTimelockContract.deployed().then((instance) => {
      return instance.newContract(receiverAddress, hashlock, timelock);
    });
  }
}