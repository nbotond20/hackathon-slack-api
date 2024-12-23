import { activeJobs } from '../constants/activeJobs'
import cron from 'node-cron'
import { db } from '@db'
import { instanceId } from '../index'
import { v4 as uuidv4 } from 'uuid'
import * as console from 'node:console'
import parser from 'cron-parser'

export const scheduleVoteEvent = async (event: any) => {
  try {
    const startDate = new Date(event.startTime * 1000)
    const cronExpression = getCronExpression(startDate, event.repeat)
    const interval = parser.parseExpression(cronExpression)
    console.log(
      'következoooo',
      interval.next().toString(),
      interval.next().toString(),
      interval.next().toString(),
      startDate,
      event.repeat
    )
    const id = event._id.toString()
    console.log('jobok törlés elott', Object.keys(activeJobs))
    stopScheduledJob(id)
    const uu = uuidv4()
    const job = cron.schedule('* * * * *', () => {
      console.log(`Job fut: ${event.title} - ${id} ${uu}`)
    })

    // Tároljuk az új jobot az `activeJobs` tárolóban
    activeJobs[id] = job
  } catch (error) {
    console.log(error)
  }
}

export const initializeJobs = async () => {
  try {
    const events = await db.collection('events').find().toArray()
    events.forEach(async event => {
      await scheduleVoteEvent(event)
    })
  } catch (error) {
    console.log(error)
  }
}

export const watchEvents = async () => {
  try {
    const changeStream = db.collection('events').watch([], { fullDocument: 'updateLookup' })

    changeStream.on('change', async change => {
      console.log('MongoDB változás észlelve')
      const lock = await db.collection('schedulerLock').findOne({ id: 'scheduler-lock' })
      if (lock?.lockedBy !== instanceId) {
        console.log('Ez az instance nem ütemez, figyelés megszakítva.')
        return
      }

      if (
        (change.operationType === 'update' &&
          ('startDate' in (change.updateDescription.updatedFields || {}) ||
            'repeat' in (change.updateDescription.updatedFields || {}))) ||
        change.operationType === 'insert'
      ) {
        await scheduleVoteEvent(change.fullDocument)
      }
      if (change.operationType === 'delete') {
        const id = change.documentKey._id.toString()
        stopScheduledJob(id)
      }
    })
  } catch (error) {
    console.error(`Hiba a változásfigyelés során: ${error.message}`)
  }
}

export const stopScheduledJob = (id: string) => {
  if (activeJobs[id]) {
    console.log('jobok', activeJobs)
    activeJobs[id].stop()
    delete activeJobs[id]
    console.log(`Job törölve: ${id}`)
  }
}

export const initializeScheduler = async () => {
  console.log(Object.keys(activeJobs), 'active jobok ')
  const lockAcquired = await acquireLock()
  if (lockAcquired) {
    await initializeJobs() // Csak akkor ütemezünk, ha megszereztük a lock-ot
  }
}

export const acquireLock = async (): Promise<boolean> => {
  const lockDuration = 60000 // 1 perc
  const now = new Date()
  const expiresAt = new Date(now.getTime() + lockDuration)
  const isLockExists = await db.collection('schedulerLock').findOne({
    id: 'scheduler-lock',
    $and: [{ lockedBy: { $ne: null }, $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] }],
  })
  console.log('Lock ellenőrzése...')
  if (isLockExists) {
    if (isLockExists.lockedBy === instanceId) {
      console.log('Az ütemezést már ez az instance kezeli.', instanceId)
      await renewLock(expiresAt)
      return false
    } else {
      console.log('Lock nem megszerezhető, másik instance kezeli az ütemezést.', instanceId)
      return false
    }
  } else {
    const result = await db.collection('schedulerLock').findOneAndUpdate(
      {
        id: 'scheduler-lock',
        $or: [{ lockedBy: null }, { expiresAt: { $lt: now } }],
      },
      {
        $set: { lockedBy: instanceId, expiresAt },
      },
      { returnDocument: 'after', upsert: true }
    )
    if (result?.lockedBy === instanceId) {
      console.log('Lock megszerezve az ütemezéshez.')
      return true
    }
  }
  return false
}

export const renewLock = async (newExpiresDate: Date) => {
  const collection = db.collection('schedulerLock')

  const result = await collection.findOneAndUpdate(
    {
      id: 'scheduler-lock',
      lockedBy: instanceId,
    },
    {
      $set: { expiresAt: newExpiresDate },
    },
    { returnDocument: 'after' }
  )
  if (result) {
    console.log('Lock megújítva:', result)
    return true
  }

  console.log('Lock megújítása nem sikerült.')
  return false
}

const getCronExpression = (date: Date, period: 'weekly' | 'monthly' | 'daily' | null) => {
  if (period === 'weekly') {
    return `${date.getMinutes()} ${date.getHours()} * * ${date.getDay()}`
  }
  if (period === 'monthly') {
    return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} * *`
  }
  if (period === 'daily') {
    return `${date.getMinutes()} ${date.getHours()} * * *`
  }
  return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`
}
