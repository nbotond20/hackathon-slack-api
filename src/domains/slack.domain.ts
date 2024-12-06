import { SlackActionPayload, SlackApiError, slackApiErrorSchema } from '@models'
import { SlackBlockKitBuilder } from '@utils/slack-helpers'
import Boom from '@hapi/boom'
import { slackApi } from '@lib/slack/slack-api'

const slackDomain = {
  // Handle approve action
  approve: async (payload: SlackActionPayload) => {
    const slackBlockKitBuilder = SlackBlockKitBuilder()

    const ts = payload.message?.ts
    const blocksWithoutAction =
      payload.message?.blocks?.filter((block: { type: string }) => block.type !== 'actions') ?? []

    const isMessages = !!payload.message && !!ts

    const channel = payload.container?.channel_id
    const username = payload.user.username
    const repostChannels = payload.actions[0].value ?? channel

    if (repostChannels) {
      const repostChannelsArray = repostChannels.split(';')

      for (const repostChannel of repostChannelsArray) {
        try {
          await slackApi.chat.postMessage({
            text: payload.message?.text ?? '',
            channel: repostChannel,
            blocks: blocksWithoutAction,
          })
        } catch (error) {
          const { success: isSlackError } = slackApiErrorSchema.safeParse(error)

          if (!isSlackError) throw Boom.internal('Something went wrong!')

          const slackError = error as SlackApiError
          const { data } = slackError

          if (data.error === 'channel_not_found') {
            await slackApi.chat.postEphemeral({
              channel,
              user: payload.user.id,
              text: `Channel #${repostChannel} not found!`,
              blocks: [slackBlockKitBuilder.createSection(`*Channel \`${repostChannel}\` was not found❗*`)],
              as_user: true,
            })
          } else if (data.error === 'not_in_channel') {
            await slackApi.chat.postEphemeral({
              channel,
              user: payload.user.id,
              text: `Release Notes bot is not in channel #${repostChannel}!`,
              blocks: [
                slackBlockKitBuilder.createSection(`*Release Notes bot is not in channel #${repostChannel}*❗`),
                slackBlockKitBuilder.createContext('Add the bot by typing `/invite @Release Notes` in the channel.'),
              ],
            })
          }

          throw Boom.internal('Something went wrong!')
        }
      }
    }

    const approveContext = slackBlockKitBuilder.createContext(`✅ *${username}* has approved this release note.`)
    if (isMessages) {
      await slackApi.chat.update({
        channel,
        ts,
        blocks: [...blocksWithoutAction, approveContext],
      })
    }
  },

  // Handle cancel action
  cancel: async (payload: SlackActionPayload) => {
    const slackBlockKitBuilder = SlackBlockKitBuilder()

    const ts = payload.message?.ts
    const blocksWithoutAction =
      payload.message?.blocks?.filter((block: { type: string }) => block.type !== 'actions') ?? []

    const isMessages = !!payload.message && !!ts

    const channel = payload.container?.channel_id
    const username = payload.user.name

    const cancelContext = slackBlockKitBuilder.createContext(`❌ *${username}* has canceled this release note.`)

    if (isMessages) {
      await slackApi.chat.update({
        channel,
        ts,
        blocks: [...blocksWithoutAction, cancelContext],
      })
    }
  },

  appHomeOpened: async (event: any) => {
    await slackApi.views.publish({
      user_id: event.user,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Welcome to Release Notes!*',
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Here you can create and manage release notes for your team.',
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Select an option below to get started.',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Create Release Note',
                },
                value: 'create_release_note',
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Release Notes',
                },
                value: 'view_release_notes',
              },
            ],
          },
        ],
      },
    })
  },
}

export default slackDomain
