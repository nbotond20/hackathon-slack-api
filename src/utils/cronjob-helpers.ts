import { activeJobs } from '../constants/activeJobs'
import cron from 'node-cron'
import { db } from '@db'
import { instanceId } from '../index'
import { v4 as uuidv4 } from 'uuid'

export const scheduleVoteEvent = async (event: any) => {
  try {
    const startDate = new Date(event.startTime * 1000)
    const cronExpression = `${startDate.getMinutes()} ${startDate.getHours()} ${startDate.getDate()} ${
      startDate.getMonth() + 1
    } *`
    const id = event._id.toString()
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
        (change.operationType === 'update' && 'startDate' in (change.updateDescription.updatedFields || {})) ||
        change.operationType === 'insert'
      ) {
        scheduleVoteEvent(change.fullDocument)
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
    activeJobs[id].stop()
    delete activeJobs[id]
    console.log(`Job törölve: ${id}`)
  }
}

/*export const watchSchedulerLock = async () => {
  const changeStream = db.collection('schedulerLock').watch()

  changeStream.on('change', async change => {
    if (change.operationType === 'update') {
      const updatedFields = change.updateDescription.updatedFields

      // Ha a `lockedBy` mező null lett, próbáljuk megszerezni a lockot
      if (updatedFields?.lockedBy === null) {
        console.log('A lock felszabadult, próbáljuk megszerezni.')
        await initializeScheduler()
      }
    }
  })

  console.log('Scheduler lock watcher elindult.')
}*/

export const initializeScheduler = async () => {
  const lockAcquired = await acquireLock()
  if (lockAcquired) {
    await initializeJobs() // Csak akkor ütemezünk, ha megszereztük a lock-ot
  }
}

export const releaseLock = async () => {
  try {
    await db
      .collection('schedulerLock')
      .findOneAndUpdate({ id: 'scheduler-lock', lockedBy: instanceId }, { $set: { lockedBy: null } })
  } catch (error) {
    console.log('Hiba történt a lock feloldása során:', error)
  }
}

export const acquireLock = async (): Promise<boolean> => {
  const lockDuration = 60000 // 1 perc
  const now = new Date()
  const expiresAt = new Date(now.getTime() + lockDuration)
  const isLockExists = await db.collection('schedulerLock').findOne({
    id: 'scheduler-lock',
    $and: [{ lockedBy: { $ne: null }, expiresAt: { $gt: now } }],
  })
  if (isLockExists) {
    if (isLockExists.lockedBy === instanceId) {
      console.log('Az ütemezést már ez az instance kezeli.')
      await renewLock(expiresAt)
      return true
    } else {
      console.log('Lock nem megszerezhető, másik instance kezeli az ütemezést.')
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
    }
  )

  if (result?.value) {
    console.log('Lock megújítva:', result.value)
    return true
  }

  console.log('Lock megújítása nem sikerült.')
  return false
}
