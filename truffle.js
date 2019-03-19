require('babel-register')
require('babel-polyfill')

const { existsSync } = require('fs')
const HDWalletProvider = require('truffle-hdwallet-provider')

const configFilePath = './config.js'
let config
if (existsSync(configFilePath)) {
  config = require(configFilePath)
} else {
  console.warn(`\nWARNING: config.js not setup - infura networks disabled\n`)
}

const oneGwei = 1000000000
const defaultGasLimit = 1600000 // enough for largest contract HashedTimelockERC20

const infuraConfig = (network, networkId, gasPrice = oneGwei) => {
  if (!config) {
    return {}
  }
  return {
    provider: function() {
      return new HDWalletProvider(
        config.infura.mnemonics[network],
        `https://${network}.infura.io/v3/${config.infura.apikey}`,
        0,
        5
      )
    },
    network_id: networkId,
    from: config.ownerAccount[network],
    gas: defaultGasLimit,
    gasPrice
  }
}

module.exports = {
  networks: {
    develop: {
      host: 'localhost',
      port: 8545,
      network_id: '*'
    },
    kovaninfura: infuraConfig('kovan', 42, oneGwei * 2),
    ropsteninfura: infuraConfig('ropsten', 3),
    rinkebyinfura: infuraConfig('rinkeby', 4)
  }
}
