import { NextFunction, Request, Response } from 'express'
import crypto from 'crypto'

// Verify Slack request signature (https://api.slack.com/authentication/verifying-requests-from-slack#making__validating-a-request)
const verifySlackRequest = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.SLACK_SIGNING_SECRET

  if (!secret) return res.status(500).send('No secret provided!')

  if (!req.headers['x-slack-request-timestamp']) return res.status(400).send('Not valid Slack request!')

  if (Math.abs(Math.floor(new Date().getTime() / 1000) - +req.headers['x-slack-request-timestamp']) > 300)
    return res.status(400).send('Request too old!')

  const baseStr = `v0:${req.headers['x-slack-request-timestamp']}:${req.rawBody}`

  const receivedSignature = req.headers['x-slack-signature']

  const expectedSignature = `v0=${crypto.createHmac('sha256', secret).update(baseStr, 'utf8').digest('hex')}`

  if (expectedSignature !== receivedSignature) {
    return res.status(400).send('Not valid Slack request!')
  }

  next()
}

export default verifySlackRequest
