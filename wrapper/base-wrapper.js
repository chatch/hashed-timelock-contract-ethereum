const contract = require("@truffle/contract")

class BaseWrapper {
  /**
   * For additional information concerning the constructor parameters,
   * @see https://www.npmjs.com/package/@truffle/contract
   * Necessary parameters for the constructor are @param contractJson, @param provider, and @param shouldDeploy.
   *
   */
  constructor(contractJson, provider, optionalAddress) {
    this.hashedTimelockContract = contract(contractJson)
    if (provider !== null) {
      this.hashedTimelockContract.setProvider(provider)
    }
    this.address = optionalAddress
  }

  /**
   * @param contractId bytes32
   * @param preimage bytes32
   * @param receiver address
   */
  withdraw(contractId, preimage, receiver) {
    return this.getContractInstance().then((instance) => {
      return instance.withdraw(contractId, preimage, {from: receiver})
    })
  }

  /**
   * @param contractId bytes 32
   * @param sender address
   */
  refund(contractId, sender) {
    return this.getContractInstance().then((instance) => {
      return instance.refund(contractId, {from: sender})
    })
  }

  /**
   * @param contractId bytes 32
   */
  getContract(contractId) {
    return this.getContractInstance().then((instance) => {
      // truffle should know using a call here
      return instance.getContract(contractId)
    })
  }

  getContractInstance() {
    if (this.address !== undefined && this.address !== null) {
      return this.hashedTimelockContract.at(this.address)
    }
    return this.hashedTimelockContract.deployed()
  }

  setAddress(address) {
    this.address = address
  }

  static deployContract(contractJson, argArray, txParams) {
    return contractJson.new(argArray, txParams);
  }
}

module.exports = BaseWrapper
