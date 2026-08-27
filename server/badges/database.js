import pg from 'pg'

const { Pool } = pg
let sharedPool

export function createBadgePool(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    statement_timeout: 15_000,
    query_timeout: 20_000,
  })
  pool.on('error', () => console.error('Badge database connection failed and was discarded.'))
  return pool
}

export function getBadgePool(databaseUrl) {
  if (!sharedPool) sharedPool = createBadgePool(databaseUrl)
  return sharedPool
}

export function resetBadgePoolForTests() {
  sharedPool = undefined
}
