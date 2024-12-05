import slackController from '@controllers/slack.controller'
import verifySlackRequest from '@middlewares/slack/verify-slack-request'
import { Router } from 'express'

const router = Router()

// Verify Slack request middleware
router.use(verifySlackRequest)

router.post('/interactions', slackController.interactions)
router.post('/events', slackController.events)
router.post('/commands', slackController.events)

export default router
