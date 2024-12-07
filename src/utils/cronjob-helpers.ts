import { activeJobs } from '../constants/activeJobs'
import cron from 'node-cron'
import { db } from '@db'
import { instanceId } from '../index'

export const scheduleVoteEvent = async (event: any) => {
  try {
    const startDate = new Date(event.startTime * 1000)
    const cronExpression = `${startDate.getMinutes()} ${startDate.getHours()} ${startDate.getDate()} ${
      startDate.getMonth() + 1
    } *`
    const id = event._id.toString()
    console.log(cronExpression, 'cronExpression', id)
    if (activeJobs[id] && event.lastUpdatedBy !== instanceId) {
      activeJobs[id].stop()
      delete activeJobs[id]
      console.log(`Korábbi job törölve: ${id} schedleVoteEvent`)
    }

    const job = cron.schedule(cronExpression, () => {
      console.log(`Job fut: ${event.name} - ${id}`)
    })

    // Tároljuk az új jobot az `activeJobs` tárolóban
    activeJobs[id] = job
  } catch (error) {
    console.log(error)
  }
}

export const watchTasks = async () => {
  try {
    const changeStream = db.collection('events').watch()

    changeStream.on('change', async change => {
      console.log('MongoDB változás:', change)

      if (change.operationType === 'update') {
        const id = change.documentKey._id.toString()
        if (activeJobs[id]) {
          activeJobs[id].stop()
          delete activeJobs[id]
          console.log(`Korábbi job törölve: ${id} watching`)
        }

        /* // Csak akkor hívjuk meg a `scheduleTask`-ot, ha a `startDate` változott
         if (updatedFields.startDate) {
           console.log(`startDate változott, újraütemezés szükséges: ${taskId}`)
           await scheduleTask(taskId)
         }*/
      }
    })

    console.log('Task változásfigyelés elindítva.')
  } catch (error) {
    console.error(`Hiba a változásfigyelés során: ${error.message}`)
  }
}
