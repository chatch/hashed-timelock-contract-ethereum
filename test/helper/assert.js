if (!global.assert) global.assert = require('chai').assert

const assertEqualBN = (actual, expected, msg = 'numbers not equal') => {
  assert.isTrue(
    actual.equals(expected),
    `
\tmsg: ${msg}
\tactual: ${actual.toString()}
\texpected: ${expected.toString()}
`
  )
}

export {assertEqualBN}
