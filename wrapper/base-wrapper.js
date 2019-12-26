export class BaseWrapper {
  contract = require("@truffle/contract")
  hashedTimelockContract
  address

  /**
   * For additional information concerning the constructor parameters,
   * @see https://www.npmjs.com/package/@truffle/contract
   * Necessary parameters for the constructor are @param contractJson, @param provider, and @param shouldDeploy.
   */
  constructor(contractJson, provider, optionalAddress, shouldDeploy, deployCallback, argArray, txParams) {
    this.hashedTimelockContract = this.contract(contractJson)
    this.hashedTimelockContract.setProvider(provider)
    this.address = optionalAddress
    if (shouldDeploy) {
      this.hashedTimelockContract.new(argArray, txParams).then((instance) => {
        // should call setAddress here
        deployCallback(instance)
      })
    }
  }

  /**
   * @param contractId bytes32
   * @param preimage bytes32
   */
  withdraw(contractId, preimage) {
    return this.getContractInstance().then((instance) => {
      return instance.withdraw(contractId, preimage)
    })
  }

  /**
   * @param contractId bytes 32
   */
  refund(contractId) {
    return this.getContractInstance().then((instance) => {
      return instance.refund(contractId)
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

  /**
   * @param contractId bytes 32
   */
  haveContract(contractId) {
    return this.getContractInstance().then((instance) => {
      return instance.haveContract(contractId)
    })
  }

  getContractInstance() {
    if (this.address !== undefined) {
      return this.hashedTimelockContract.at(this.address)
    }
    return this.hashedTimelockContract.deployed()
  }

  setAddress(address) {
    this.address = address
  }
}
