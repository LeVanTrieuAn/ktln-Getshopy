const { createClient } = require('@clickhouse/client');

const client = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'analytics',
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 0,
  },
});

async function query(sql, params = {}) {
  const result = await client.query({ query: sql, query_params: params, format: 'JSONEachRow' });
  return result.json();
}

async function insert(table, values) {
  await client.insert({ table, values, format: 'JSONEachRow' });
}

async function ping() {
  return client.ping();
}

module.exports = { query, insert, ping };
