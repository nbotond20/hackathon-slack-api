import { SlackActionPayload, SlackApiError, slackApiErrorSchema } from '@models'
import { slackApi } from '@lib/slack/slack-api'
import { DAY_OPTIONS } from 'src/constants/DAY_OPTIONS'
import { db } from '@db'
import { scheduleVoteEvent } from '@utils/cronjob-helpers'
import { ObjectId } from 'mongodb'
import { instanceId } from '../index'
import { deepFlatten } from '@utils/deepFlatten'

const slackDomain = {
  appHomeSubmitted: async (payload: SlackActionPayload) => {
    const { values: formValues } = payload.view.state
    const [title, options, startTime, channels] = Object.values(formValues)

    const dbObject = {
      title: title['event-title']['value'],
      options: options['event-options']['selected_options'],
      startTime: startTime['event-start-time']['selected_date_time'],
      selectedChannels: channels['multi_users_select-action']['selected_channels'],
      lastUpdatedBy: instanceId,
    }

    const collection = db.collection('events')

    await collection.insertOne(dbObject)

    const previousEvents = await collection.find().sort({ _id: -1 }).toArray()

    const lastEvent = previousEvents[0]

    await scheduleVoteEvent(lastEvent)

    const titleBlock = {
      'type': 'header',
      'block_id': event?._id.toString(),
      'text': {
        type: 'plain_text',
        text: `${lastEvent!.title}`,
        'emoji': true,
      },
    }

    const blocks = lastEvent!.options
      .map(({ text, value }: any) => [
        {
          type: 'divider',
        },
        {
          'type': 'rich_text',
          'elements': [
            {
              'type': 'rich_text_section',
              'elements': [
                {
                  'type': 'text',
                  'text': text.text,
                  'style': {
                    'bold': true,
                  },
                },
              ],
            },
          ],
        },
        {
          'type': 'actions',
          'elements': [
            {
              'type': 'button',
              'text': {
                'type': 'plain_text',
                'emoji': true,
                'text': 'Vote',
              },
              'style': 'primary',
              'value': value,
              'action_id': 'vote-action',
            },
            {
              'type': 'button',
              'text': {
                'type': 'plain_text',
                'emoji': true,
                'text': '+1',
              },
              'action_id': 'plus-one-action',
              'value': value,
            },
          ],
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'plain_text',
              'emoji': true,
              'text': '3 votes',
            },
          ],
        },
      ])
      .flat()

    await slackApi.chat.postMessage({
      channel: 'C084N8KBJTA',
      blocks: [titleBlock, ...blocks],
    })

    await slackDomain.appHomeOpened({ user: payload.user.id })
  },

  appHomeOpened: async (event: any) => {
    const collection = db.collection('events')
    const previousEvents = await collection.find().sort({ _id: -1 }).toArray()

    const lastEvent = previousEvents[0]

    const eventBlocks = previousEvents
      .map(event => [
        {
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': `*${event.title}*`,
            },
          ],
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': event.options.map(option => option.text.text).join(', '),
            },
          ],
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': new Date(event.startTime * 1000).toLocaleString(),
            },
          ],
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': 'Channels: ' + event.selectedChannels.map((channel: any) => `<#${channel}>`).join(', '),
            },
          ],
        },
        {
          'type': 'actions',
          'elements': [
            {
              'type': 'button',
              'text': {
                'type': 'plain_text',
                'text': 'Delete',
                'emoji': true,
              },
              'style': 'danger',
              'value': event._id.toString(),
              'action_id': 'delete-event-action',
            },
          ],
        },
        {
          'type': 'divider',
        },
      ])
      .flat()

    await slackApi.views.publish({
      user_id: event.user,
      view: {
        'type': 'home',
        'blocks': [
          {
            'type': 'header',
            'text': {
              'type': 'plain_text',
              'text': 'Create new event',
              'emoji': true,
            },
          },
          {
            'type': 'input',
            'element': {
              'type': 'plain_text_input',
              'action_id': 'event-title',
              'initial_value': lastEvent?.title,
            },
            'label': {
              'type': 'plain_text',
              'text': 'Event Title',
              'emoji': true,
            },
          },
          {
            'type': 'input',
            'element': {
              'type': 'multi_static_select',
              'placeholder': {
                'type': 'plain_text',
                'text': 'Select options',
                'emoji': true,
              },
              'options': DAY_OPTIONS.map(option => ({
                'text': {
                  'type': 'plain_text',
                  'text': option.name,
                  'emoji': true,
                },
                'value': option.id,
              })),
              'action_id': 'event-options',
              'initial_options': lastEvent?.options,
            },
            'label': {
              'type': 'plain_text',
              'text': 'Options',
              'emoji': true,
            },
          },
          {
            'type': 'input',
            'element': {
              'type': 'datetimepicker',
              'action_id': 'event-start-time',
              initial_date_time: lastEvent?.startTime,
            },
            'label': {
              'type': 'plain_text',
              'text': 'Vote Starts',
              'emoji': true,
            },
          },
          {
            'type': 'input',
            'element': {
              'type': 'multi_channels_select',
              'placeholder': {
                'type': 'plain_text',
                'text': 'Select channels',
                'emoji': true,
              },
              'action_id': 'multi_users_select-action',
              'initial_channels': lastEvent?.selectedChannels,
            },
            'label': {
              'type': 'plain_text',
              'text': 'Select channels',
              'emoji': true,
            },
          },
          {
            'type': 'actions',
            'elements': [
              {
                'type': 'button',
                'text': {
                  'type': 'plain_text',
                  'text': 'Save',
                  'emoji': true,
                },
                'value': 'submit',
                'style': 'primary',
                'action_id': 'submit-action',
              },
            ],
          },
          {
            'type': 'divider',
          },
          {
            'type': 'header',
            'text': {
              'type': 'plain_text',
              'text': 'Previous events',
              'emoji': true,
            },
          },
          ...eventBlocks,
        ],
      },
    })
  },

  addVote: async (payload: any) => {
    try {
      const messageId = payload.message.ts
      const blocks = payload.message.blocks
      const headerBlock = blocks[0]
      const eventId = headerBlock.block_id

      const { value } = payload.actions[0]
      const eventCollection = db.collection('events')
      const foundSetting = await eventCollection.findOne({ _id: new ObjectId(eventId) })
      console.log('foundSetting: ', foundSetting)
      if (!foundSetting) {
        return
      }

      const voteBlockIndex = blocks.findIndex((block: any) => {
        return block.elements?.[0].value === value
      })
      const voteBlockContext = blocks[voteBlockIndex + 1]

      const userProfile = await slackApi.users.info({
        user: payload.user.id,
      })
      const profilePic = userProfile.user?.profile?.image_48
      const name = userProfile.user?.real_name

      console.log('voteBlockContext: ', voteBlockContext)

      voteBlockContext.elements.push({
        'type': 'image',
        'image_url': profilePic,
        'alt_text': name,
      })

      blocks[voteBlockIndex + 1] = voteBlockContext

      /* await slackApi.reactions.add({
        name: 'thumbsup::skin-tone-6',
        channel: payload.channel.id,
        timestamp: messageId,
      }) */
      console.log(blocks)

      await slackApi.chat.update({
        ts: messageId,
        channel: payload.channel.id,
        blocks,
      })
    } catch (error) {
      console.log('Error adding reaction', error)
    }
  },

  showOutsiderModal: async (payload: any) => {
    const { trigger_id } = payload

    await slackApi.views.open({
      trigger_id,
      view: {
        'title': {
          'type': 'plain_text',
          'text': 'Add +1',
          'emoji': true,
        },
        'submit': {
          'type': 'plain_text',
          'text': 'Submit',
          'emoji': true,
        },
        'type': 'modal',
        'close': {
          'type': 'plain_text',
          'text': 'Cancel',
          'emoji': true,
        },
        'blocks': [
          {
            'type': 'input',
            'element': {
              'type': 'plain_text_input',
              'action_id': 'plus1-name',
            },
            'label': {
              'type': 'plain_text',
              'text': 'Name',
              'emoji': true,
            },
          },
          {
            'type': 'input',
            'element': {
              'type': 'email_text_input',
              'action_id': 'plus1-email',
            },
            'label': {
              'type': 'plain_text',
              'text': 'Email',
              'emoji': true,
            },
          },
        ],
      },
    })
  },

  addOutsider: async (payload: any) => {
    const { values: formValues } = payload.view.state
    const [name, email] = Object.values(formValues)
    console.log('name, email: ', name, email, payload.user.id)
  },

  deleteEvent: async (payload: any) => {
    const toDeleteId = payload.actions[0].value
    const eventCollection = db.collection('events')
    await eventCollection.deleteOne({ _id: new ObjectId(toDeleteId) })
    await slackDomain.appHomeOpened({ user: payload.user.id })
  },
}

export default slackDomain
