import { NextFunction, Request, Response } from 'express'
import Boom from '@hapi/boom'

import { SlackActionPayload, slackActionPayloadSchema } from '@models'
import { getActionTypes } from '@utils/slack-helpers'
import slackDomain from '@domains/slack.domain'

const SlackController = {
  interactions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = JSON.parse(req.body.payload) as SlackActionPayload

      const { success: isValidPayload } = slackActionPayloadSchema.safeParse(payload)
      if (!isValidPayload) throw Boom.badRequest('Invalid request!')

      const actionIds = getActionTypes(payload.actions)

      switch (true) {
        case actionIds.includes('approve'):
          await slackDomain.approve(payload)
          break
        case actionIds.includes('cancel'):
          await slackDomain.cancel(payload)
          break
        default:
          throw Boom.badRequest('Invalid action!')
      }

      return res.sendStatus(200)
    } catch (error) {
      next(error)
    }
  },
  events: async (req: Request, res: Response, _next: NextFunction) => {
    const challenge = req.body.challenge
    
    console.log(JSON.stringify(req.body, null, 2))

    return res.send(challenge).status(200)
  },
  commands: async (req: Request, res: Response, _next: NextFunction) => {
    console.log(req.body)
    console.log(req.query)
    return res.sendStatus(200)
  },
}

export default SlackController
