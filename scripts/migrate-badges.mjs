import { readFile } from 'node:fs/promises'

import pg from 'pg'

const databaseUrl = process.env.BADGE_DATABASE_URL
  || process.env.DATABASE_URL_UNPOOLED
  || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('BADGE_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required.')

const sql = await readFile(new URL('../db/migrations/0007_score_triggered_eas_badges.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: databaseUrl })
try {
  await client.connect()
  await client.query(sql)
  console.log('Score-triggered EAS badge migration applied.')
} finally {
  await client.end()
}
