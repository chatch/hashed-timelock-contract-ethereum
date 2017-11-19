var HashedTimelock = artifacts.require('./HashedTimelock.sol')
var HashedTimelockERC20 = artifacts.require('./HashedTimelockERC20.sol')

module.exports = function(deployer) {
  deployer.deploy(HashedTimelock)
  deployer.deploy(HashedTimelockERC20)
}
