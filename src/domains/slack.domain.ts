import { SlackActionPayload, SlackApiError, slackApiErrorSchema } from '@models'
import { slackApi } from '@lib/slack/slack-api'
import { DAY_OPTIONS } from 'src/constants/DAY_OPTIONS'
import { db } from '@db'

const slackDomain = {
  appHomeSubmitted: async (payload: SlackActionPayload) => {
    const { values: formValues } = payload.view.state
    const [title, options, startTime] = Object.values(formValues)

    const dbObject = {
      title: title['event-title']['value'],
      options: options['event-options']['selected_options'],
      startTime: startTime['event-start-time']['selected_date_time'],
    }

    const collection = db.collection('events')
    const foundSettings = await collection.findOne()
    await collection.updateOne({ _id: foundSettings?._id }, { $set: dbObject }, { upsert: true })

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

    const voteCollection = db.collection('votes')
    console.log('foundSetting', foundSetting)
  },

  buildVoteBlocks: async () => {
    const event = await db.collection('events').findOne()

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
  },
}

export default slackDomain
