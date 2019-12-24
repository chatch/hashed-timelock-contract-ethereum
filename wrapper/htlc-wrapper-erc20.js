import {BaseWrapper} from "./base-wrapper"

/**
 * This wrapper can be used for already deployed contracts sharing the 3 main interfaces of HTLCs.
 */
export class HtlcErc20Wrapper extends BaseWrapper{
  hashedTimelockContract;

  constructor(contractJson) {
    super(contractJson);
  }

  /**
   * Returns the contract ID.
   * @param receiverAddress address
   * @param hashlock bytes 32
   * @param timelock uint
   * @param tokenContract address
   * @param amount uint
   */
  newContract(receiverAddress, hashlock, timelock, tokenContract, amount) {
    return this.hashedTimelockContract.deployed().then((instance) => {
      return instance.newContract(receiverAddress, hashlock, timelock);
    });
  }
}