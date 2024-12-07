import { Db, MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI env variable.')

const DB_NAME = 'slack-bot-api'
export const client = new MongoClient(process.env.MONGODB_URI)
export let db: Db
export const initDB = async () => {
  await client.connect()
  db = client.db(DB_NAME)
  db.collection('schedulerLock').createIndex({ id: 1 }, { unique: true })
}
