import { Action } from '@models'

const ALLOWED_ACTIONS = ['approve', 'cancel'] as const

export const getActionTypes = (actions: Action[]) => {
  return actions
    .map(({ action_id }) => action_id)
    .filter(action => (Array.from(ALLOWED_ACTIONS) as string[]).includes(action)) as (typeof ALLOWED_ACTIONS)[number][]
}

export const SlackBlockKitBuilder = () => {
  const createContext = (text: string | string[]) => {
    if (typeof text === 'string') {
      return {
        'type': 'context',
        'elements': [
          {
            'type': 'mrkdwn',
            'text': text,
          },
        ],
      }
    }

    return {
      'type': 'context',
      'elements': text.map(text => ({
        'type': 'mrkdwn',
        'text': text,
      })),
    }
  }

  const createSection = (text: string | string[]) => {
    if (typeof text === 'string') {
      return {
        'type': 'section',
        'text': {
          'type': 'mrkdwn',
          'text': text,
        },
      }
    }

    return {
      'type': 'section',
      'text': {
        'type': 'mrkdwn',
        'text': text.join('\n'),
      },
    }
  }

  return {
    createContext,
    createSection,
  }
}
