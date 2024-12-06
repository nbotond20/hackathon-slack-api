import { NextFunction, Request, Response } from 'express'

import { SlackActionPayload } from '@models'
import slackDomain from '@domains/slack.domain'
import { slackApi } from '@lib/slack/slack-api'
import { db } from '@db'

const SlackController = {
  interactions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = JSON.parse(req.body.payload) as SlackActionPayload
      console.log('im here', payload)

      if (payload.type === 'block_actions') {
        if (payload.actions[0].action_id === 'submit-action') {
          await slackDomain.appHomeSubmitted(payload)
        }
        if (payload.actions[0].action_id === 'vote-action') {
          await slackDomain.addVote(payload)
        }
      }

      return res.sendStatus(200)
    } catch (error) {
      next(error)
    }
  },
  events: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const challenge = req.body.challenge

      const { event } = req.body

      switch (event.type) {
        case 'app_home_opened':
          await slackDomain.appHomeOpened(event)
      }

      return res.send(challenge).status(200)
    } catch (error) {
      next(error)
    }
  },
  commands: async (req: Request, res: Response, _next: NextFunction) => {
    console.log(req.body)
    console.log(req.query)
    return res.sendStatus(200)
  },
  demo: async (req: Request, res: Response, _next: NextFunction) => {
    await slackDomain.buildVoteBlocks()
    return res.sendStatus(200)
  },
}

export default SlackController
