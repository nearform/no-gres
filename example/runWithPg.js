const assert = require('assert')
const Client = require('pg').Client
const fetchCustomer = require('./fetchCustomer')

const doTest = async () => {
  const dbClient = new Client()

  await dbClient.connect()

  // Set up test data
  await dbClient.query(`CREATE TABLE customer (
    id INTEGER,
    firstname VARCHAR(16),
    lastname VARCHAR(16)
    )`)

  try {
    await dbClient.query(`INSERT INTO customer (id, firstname, lastname) VALUES (1, 'Mal', 'Reynolds')`)
    await dbClient.query(`INSERT INTO customer (id, firstname, lastname) VALUES (2, 'Jayne','Cobb' )`)
    const result = await fetchCustomer.fetchCustomerById(dbClient, 2)
    assert.deepStrictEqual(result, ['Jayne Cobb'])
    console.log('PG test ok')
  } catch (err) {
    console.error(err)
  } finally {
    await dbClient.query(`DROP TABLE customer`)
    await dbClient.end()
  }
}

module.exports = doTest
