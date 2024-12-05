import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import * as dotenv from 'dotenv'
import { IncomingMessage } from 'http'

// Load environment variables from .env file
dotenv.config()

// Create Express server
const app = express()

// Express configuration
app.use(cors())
app.use(helmet())
app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
    verify: (req: IncomingMessage, _, buf) => {
      req.rawBody = buf
    },
  })
)
app.use(morgan('tiny'))

export default app
