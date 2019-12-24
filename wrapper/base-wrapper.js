export class BaseWrapper {
  contract = require("@truffle/contract");
  hashedTimelockContract;

  constructor(contractJson) {
    this.hashedTimelockContract = this.contract(contractJson);
  }

  /**
   * @param contractId bytes32
   * @param preimage bytes32
   */
  withdraw(contractId, preimage) {
    return this.hashedTimelockContract.deployed().then((instance) => {
      return instance.withdraw(contractId, preimage);
    });
  }

  /**
   * @param contractId bytes 32
   */
  refund(contractId) {
    return this.hashedTimelockContract.deployed().then((instance) => {
      return instance.refund(contractId);
    });
  }

  /**
   * @param contractId bytes 32
   */
  getContract(contractId) {
    return this.hashedTimelockContract.deployed().then((instance) => {
      // truffle should know to use a call here
      return instance.getContract(contractId);
    });
  }

  /**
   * @param contractId bytes 32
   */
  haveContract(contractId) {
    return this.hashedTimelockContract.deployed().then((instance) => {
      return instance.haveContract(contractId);
    });
  }
}