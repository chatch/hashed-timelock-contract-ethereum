var HashedTimelock = artifacts.require('./HashedTimelock.sol')

module.exports = function(deployer) {
  deployer.deploy(HashedTimelock)
}
