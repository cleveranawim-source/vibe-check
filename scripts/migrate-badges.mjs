import { readFile } from 'node:fs/promises'

import pg from 'pg'

const databaseUrl = process.env.BADGE_DATABASE_URL
  || process.env.DATABASE_URL_UNPOOLED
  || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('BADGE_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required.')

const migrations = [
  '../db/migrations/0007_score_triggered_eas_badges.sql',
  '../db/migrations/0008_gasless_offchain_badges.sql',
]
const client = new pg.Client({ connectionString: databaseUrl })
try {
  await client.connect()
  for (const migration of migrations) {
    const sql = await readFile(new URL(migration, import.meta.url), 'utf8')
    await client.query(sql)
  }
  console.log('Score-triggered gasless badge migrations applied.')
} finally {
  await client.end()
}
