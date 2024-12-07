import { SlackActionPayload, SlackApiError, slackApiErrorSchema } from '@models'
import { slackApi } from '@lib/slack/slack-api'
import { DAY_OPTIONS } from 'src/constants/DAY_OPTIONS'
import { db } from '@db'
import { scheduleVoteEvent } from '@utils/cronjob-helpers'
import { ObjectId } from 'mongodb'
import { instanceId } from '../index'

const slackDomain = {
  appHomeSubmitted: async (payload: SlackActionPayload) => {
    const { values: formValues } = payload.view.state
    const [title, options, startTime] = Object.values(formValues)

    const dbObject = {
      title: title['event-title']['value'],
      options: options['event-options']['selected_options'],
      startTime: startTime['event-start-time']['selected_date_time'],
      lastUpdatedBy: instanceId,
    }

    const collection = db.collection('events')
    const foundSettings = await collection.findOne()
    const result = await collection.updateOne(
      { _id: foundSettings?._id || new ObjectId() },
      { $set: dbObject },
      { upsert: true }
    )
    const object = foundSettings ? { ...foundSettings, ...dbObject } : { ...dbObject, _id: result.upsertedId }
    await scheduleVoteEvent(object)

    const event = await db.collection('events').findOne({ _id: object._id! })

    const titleBlock = {
      'type': 'header',
      'text': {
        type: 'plain_text',
        text: `${event!.title}`,
        'emoji': true,
      },
    }

    const blocks = event!.options
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
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': '<!subteam^S08432SPV2Q>',
          },
        },
      ])
      .flat()

    await slackApi.chat.postMessage({
      channel: 'C084N8KBJTA',
      blocks: [titleBlock, ...blocks],
    })

    await slackApi.views.update({
      view_id: payload.view.id,
      view: {
        'type': 'home',
        'blocks': [
          ...payload.view.blocks,
          {
            'type': 'section',
            'text': {
              'type': 'mrkdwn',
              'text': `*Saved*`,
            },
          },
        ],
      },
    })
  },

  appHomeOpened: async (event: any) => {
    const collection = db.collection('events')
    const foundSettings = await collection.findOne()

    await slackApi.views.publish({
      user_id: event.user,
      view: {
        'type': 'home',
        'blocks': [
          {
            'type': 'input',
            'element': {
              'type': 'plain_text_input',
              'action_id': 'event-title',
              'initial_value': foundSettings?.title,
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
              'initial_options': foundSettings?.options,
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
              initial_date_time: foundSettings?.startTime,
            },
            'label': {
              'type': 'plain_text',
              'text': 'Vote Starts',
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
        ],
      },
    })
  },

  addVote: async (payload: any) => {
    const { value } = payload.actions[0]
    const eventCollection = db.collection('events')
    const foundSetting = await eventCollection.findOne()
    if (!foundSetting) {
      return
    }

    console.log('Adding vote to', value)

    const messageId = payload.message.ts

    try {
      await slackApi.reactions.add({
        name: 'thumbsup::skin-tone-6',
        channel: payload.channel.id,
        timestamp: messageId,
      })
    } catch (error) {
      console.log('Error adding reaction', error)
    }
    const userProfile = await slackApi.users.info({
      user: payload.user.id,
    })
    const profilePic = userProfile.user?.profile?.image_48
    console.log('Profile pic', profilePic)

    console.log('Vote added')
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
}

export default slackDomain
