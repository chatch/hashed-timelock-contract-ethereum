require('babel-register')
require('babel-polyfill')

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 1000000
    },
    ropsten: {
      host: 'localhost',
      port: 8545,
      network_id: 3,
    },
  },
}
