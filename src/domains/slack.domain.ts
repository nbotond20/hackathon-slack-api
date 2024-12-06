import { SlackActionPayload, SlackApiError, slackApiErrorSchema } from '@models'
import { slackApi } from '@lib/slack/slack-api'

const slackDomain = {
  appHomeSubmitted: async (payload: SlackActionPayload) => {
    const { values: formValues } = payload.view.state
    console.log(JSON.stringify(Object.values(formValues), null, 2))
  },

  appHomeOpened: async (event: any) => {
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
              'options': [
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Hétfő',
                    'emoji': true,
                  },
                  'value': 'day-1',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Kedd',
                    'emoji': true,
                  },
                  'value': 'day-2',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Szerda',
                    'emoji': true,
                  },
                  'value': 'day-3',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Csütörtök',
                    'emoji': true,
                  },
                  'value': 'day-4',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Péntek',
                    'emoji': true,
                  },
                  'value': 'day-5',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Szombat',
                    'emoji': true,
                  },
                  'value': 'day-6',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Vasárnap',
                    'emoji': true,
                  },
                  'value': 'day-7',
                },
              ],
              'action_id': 'event-options',
            },
            'label': {
              'type': 'plain_text',
              'text': 'Options',
              'emoji': true,
            },
          },
          {
            'type': 'rich_text',
            'elements': [
              {
                'type': 'rich_text_section',
                'elements': [
                  {
                    'type': 'text',
                    'text': 'Vote Starts',
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
                'type': 'datepicker',
                'initial_date': '2024-12-06',
                'placeholder': {
                  'type': 'plain_text',
                  'text': 'Select a date',
                  'emoji': true,
                },
                'action_id': 'event-start-date',
              },
              {
                'type': 'timepicker',
                'initial_time': '13:37',
                'placeholder': {
                  'type': 'plain_text',
                  'text': 'Select time',
                  'emoji': true,
                },
                'action_id': 'event-start-time',
              },
            ],
          },
          {
            'type': 'input',
            'element': {
              'type': 'radio_buttons',
              'options': [
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Weekly',
                    'emoji': true,
                  },
                  'value': 'weekly',
                },
              ],
              'action_id': 'event-weekly',
            },
            'label': {
              'type': 'plain_text',
              'text': 'Recurring',
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
}

export default slackDomain
