'use strict'

const runWithPg = require('./runWithPg')
const runWithNoGres = require('./runWithNoGres')

const doTest = async () => {
  await runWithPg()
  await runWithNoGres()
}

doTest()
