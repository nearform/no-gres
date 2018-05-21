'use strict'

const fetchCustomerById = async (db, customerId) => {
  const rows = await db.query('SELECT firstname, lastname FROM customer WHERE id = $1', [customerId])
  return rows.rows.map((r) => `${r.firstname} ${r.lastname}`)
}

module.exports = {
  fetchCustomerById
}
