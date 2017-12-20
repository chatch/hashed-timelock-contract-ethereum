require('babel-register')
require('babel-polyfill')

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 9545,
      network_id: '4447',
    },
    gui: { // ganache gui defaults
      host: 'localhost',
      port: 7545,
      network_id: '5777',
    },
    ropsten: {
      // use --geth mode for Parity or this will fail (see https://github.com/paritytech/parity/issues/5538)
      host: '0.0.0.0', // Local Parity Docker container
      port: 8545,
      network_id: 3,
      gas: 4000000,
      gasPrice: 4000000000, // 4 shannon/gwei
    },
  },
}
