if (!global.assert) global.assert = require('chai').assert

const assertEqualBN = (actual, expected, msg = 'numbers not equal') => {
  if (!web3.utils.isBN(actual))
    actual = web3.utils.toBN(actual)
  if (!web3.utils.isBN(expected))
    expected = web3.utils.toBN(expected)
  assert.isTrue(
    actual.eq(expected),
    `
\tmsg: ${msg}
\tactual: ${actual.toString()}
\texpected: ${expected.toString()}
`
  )
}

module.exports = {assertEqualBN}
