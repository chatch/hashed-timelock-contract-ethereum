require('babel-register')
require('babel-polyfill')

const defaultGasLimit = 1200000 // enough for largest contract HashedTimelockERC20
const ownerAccount = '0x62d5391445c0c843580b92705b84852b9edb813b'

module.exports = {
  networks: {
    develop: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
    },
    kovan: {
      // use --geth mode for Parity or this will fail (see https://github.com/paritytech/parity/issues/5538)
      host: '0.0.0.0', // Local Parity Docker container
      port: 8545,
      network_id: 42,
      from: ownerAccount,
      gas: defaultGasLimit,
      gasPrice: 2000000000, // 2 shannon/gwei
    },
    ropsten: {
      // use --geth mode for Parity or this will fail (see https://github.com/paritytech/parity/issues/5538)
      host: '0.0.0.0', // Local Parity Docker container
      port: 8545,
      network_id: 3,
      from: ownerAccount,
      gas: defaultGasLimit,
      gasPrice: 8000000000, // 8 shannon/gwei
    },
  },
}
