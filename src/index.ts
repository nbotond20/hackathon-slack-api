import app from './app'
import errorHandler from '@middlewares/error-handler'
import slackRoute from '@routes/slack.route'
import { Boom } from '@hapi/boom'
import { initDB } from '@db'
import { watchTasks } from '@utils/cronjob-helpers'
import { v4 as uuidv4 } from 'uuid'

const BASE_URL = '/api/v1'

function setBasePath(route: string) {
  return `${BASE_URL}${route}`
}

export const instanceId = `instance-${uuidv4()}`

const main = async () => {
  await initDB()
  //await initializeJobs(); // Összes job újraütemezése
  watchTasks() // Változásfigyelés elindítása
  // List the available routes
  app.use(setBasePath('/'), slackRoute)

  // Health check
  app.get('/__/health', (_, res) => {
    res.status(200).json({ status: 'ok' })
  })

  // Catch 404 and forward to error handler
  app.use((_, __, next) => {
    next(new Boom('Unkown request!', { statusCode: 404 }))
  })

  // Error handler. Must be the last middleware
  app.use(errorHandler)

  // Start the server
  app.listen(parseInt(process.env.PORT || '5000'), () => {
    // eslint-disable-next-line no-console
    console.log(`Server started on http://localhost:${parseInt(process.env.PORT || '5000')}`)
  })
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err)
})
