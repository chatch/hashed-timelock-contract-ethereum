require("babel-register")
require("babel-polyfill")

const { existsSync } = require("fs")
const HDWalletProvider = require("truffle-hdwallet-provider")

const configFilePath = "./config.js"
if (!existsSync(configFilePath)) {
  console.error(
    `config.js does not exist. Create it using the template config.example.js.`
  )
  process.exit(-1)
}
const config = require(configFilePath)

const oneGwei = 1000000000
const defaultGasLimit = 1600000 // enough for largest contract HashedTimelockERC20

const infuraConfig = (network, networkId, gasPrice = oneGwei) => {
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
      host: "localhost",
      port: 8545,
      network_id: "*"
    },
    kovaninfura: infuraConfig("kovan", 42, oneGwei * 2),
    ropsteninfura: infuraConfig("ropsten", 3),
    rinkebyinfura: infuraConfig("rinkeby", 4),
    kovan: {
      // use --geth mode for Parity or this will fail (see https://github.com/paritytech/parity/issues/5538)
      host: "0.0.0.0", // Local Parity Docker container
      port: 8545,
      network_id: 42,
      from: config.ownerAccount.kovan,
      gas: defaultGasLimit,
      gasPrice: oneGwei * 2
    }
  }
}
