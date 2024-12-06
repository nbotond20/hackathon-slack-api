import { NextFunction, Request, Response } from 'express'
import Boom from '@hapi/boom'

import { SlackActionPayload, slackActionPayloadSchema } from '@models'
import { getActionTypes } from '@utils/slack-helpers'
import slackDomain from '@domains/slack.domain'
import { slackApi } from '@lib/slack/slack-api'

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
  events: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const challenge = req.body.challenge

      const event = req.event

      switch (event) {
        case 'app_home_opened':
          await slackDomain.appHomeOpened(req)
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
    await slackApi.chat.postMessage({
      channel: 'C084BT92QKT',
      blocks: [
        {
          'type': 'section',
          'text': {
            'type': 'plain_text',
            'text': 'This is a section block with checkboxes.',
          },
          'accessory': {
            'type': 'checkboxes',
            'options': [
              {
                'text': {
                  'type': 'plain_text',
                  'text': '*this is plain_text text*',
                },
                'description': {
                  'type': 'plain_text',
                  'text': '*this is plain_text text*',
                },
                'value': 'value-0',
              },
              {
                'text': {
                  'type': 'plain_text',
                  'text': '*this is plain_text text*',
                },
                'description': {
                  'type': 'plain_text',
                  'text': '*this is plain_text text*',
                },
                'value': 'value-1',
              },
              {
                'text': {
                  'type': 'plain_text',
                  'text': '*this is plain_text text*',
                },
                'description': {
                  'type': 'plain_text',
                  'text': '*this is plain_text text*',
                },
                'value': 'value-2',
              },
            ],
            'action_id': 'checkboxes-action',
          },
        },
        {
          'type': 'section',
          'text': {
            'type': 'plain_text',
            'text': 'This is a section block with a button.',
          },
          'accessory': {
            'type': 'button',
            'text': {
              'type': 'plain_text',
              'text': 'Click Me',
              'emoji': true,
            },
            'value': 'click_me_123',
            'action_id': 'button-action',
          },
        },
      ],
    })
    return res.sendStatus(200)
  },
}

export default SlackController
