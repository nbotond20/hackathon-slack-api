import { SlackActionPayload } from '@models'
import { slackApi } from '@lib/slack/slack-api'
import { DAY_OPTIONS } from 'src/constants/DAY_OPTIONS'
import { db } from '@db'
import { scheduleVoteEvent } from '@utils/cronjob-helpers'
import { ObjectId } from 'mongodb'
import { instanceId } from '../index'
import { client } from '../lib/db'
import { Response } from 'express'

const slackDomain = {
  appHomeSubmitted: async (payload: SlackActionPayload) => {
    const { values: formValues } = payload.view.state
    const [title, options, startTime, channels, recurring, limits] = Object.values(formValues)

    const dbObject = {
      title: title['event-title']['value'],
      options: options['event-options']['selected_options'],
      startTime: startTime['event-start-time']['selected_date_time'],
      selectedChannels: channels['multi_users_select-action']['selected_channels'],
      limits: limits['event-limits']['selected_options'],
      repeat: recurring['event-recurring']['selected_option']?.value,
      lastUpdatedBy: instanceId,
    }

    if (!dbObject.title || !dbObject.options || !dbObject.startTime || !dbObject.selectedChannels?.length) {
      return
    }

    const collection = db.collection('events')

    const res = await collection.insertOne(dbObject)

    const lastEvent = { ...dbObject, _id: res.insertedId }

    const titleBlock = [
      {
        'type': 'header',
        'block_id': lastEvent?._id.toString(),
        'text': {
          type: 'plain_text',
          text: `${lastEvent!.title}`,
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
              'text': 'Finish Voting',
              'emoji': true,
            },
            'value': lastEvent._id,
            'action_id': 'event-finish-voting-action',
          },
        ],
      },
    ]

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
              'value': JSON.stringify({ eventId: lastEvent._id, option: value }),
            },
          ],
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'plain_text',
              'emoji': true,
              'text': '0 votes',
            },
          ],
        },
      ])
      .flat()

    const messageResponses = []

    for (const channel of lastEvent.selectedChannels) {
      const res = await slackApi.chat.postMessage({
        channel: channel,
        blocks: [...titleBlock, ...blocks],
      })
      messageResponses.push(res)
    }

    // Update the event with the message ids
    await collection.updateOne(
      { _id: res.insertedId },
      {
        $set: {
          messages: messageResponses.map(res => ({
            ts: res.ts,
            channel: res.channel,
          })),
        },
      }
    )

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
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': 'Limits: ' + event.limits.map(limit => limit.text.text).join(', '),
            },
          ],
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': event.repeat ? 'Recurring: ' + event.repeat : 'Not recurring',
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
            'type': 'input',
            'element': {
              'type': 'static_select',
              'placeholder': {
                'type': 'plain_text',
                'text': 'Not recurring',
                'emoji': true,
              },
              'options': [
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Daily',
                    'emoji': true,
                  },
                  'value': 'daily',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Weekly',
                    'emoji': true,
                  },
                  'value': 'weekly',
                },
                {
                  'text': {
                    'type': 'plain_text',
                    'text': 'Monthly',
                    'emoji': true,
                  },
                  'value': 'monthly',
                },
              ],
              'action_id': 'event-recurring',
              'initial_option': lastEvent?.repeat
                ? {
                    'text': {
                      'type': 'plain_text',
                      'text': lastEvent?.repeat.charAt(0).toUpperCase() + lastEvent?.repeat.slice(1),
                      'emoji': true,
                    },
                    'value': lastEvent?.repeat,
                  }
                : undefined,
            },
            'label': {
              'type': 'plain_text',
              'text': 'Recurring (optional)',
              'emoji': true,
            },
          },
          {
            'type': 'input',
            'element': {
              'type': 'multi_static_select',
              'placeholder': {
                'type': 'plain_text',
                'text': 'Select limits',
                'emoji': true,
              },
              'options': Array.from({ length: 100 }, (_, i) => i + 1).map(option => ({
                'text': {
                  'type': 'plain_text',
                  'text': option.toString(),
                  'emoji': true,
                },
                'value': option.toString(),
              })),
              'action_id': 'event-limits',
              ...(lastEvent?.limits && {
                'initial_options': lastEvent?.limits.map(limit => ({
                  'text': {
                    'type': 'plain_text',
                    'text': limit.text.text,
                    'emoji': true,
                  },
                  'value': limit.value,
                })),
              }),
            },
            'label': {
              'type': 'plain_text',
              'text': 'Limits (optional)',
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
      // Start transaction
      const session = client.startSession()
      session.startTransaction()

      const messageId = payload.message.ts
      const blocks = payload.message.blocks
      const headerBlock = blocks[0]
      const eventId = headerBlock.block_id

      const { value } = payload.actions[0]
      const eventCollection = db.collection('events')
      const foundSetting = await eventCollection.findOne({ _id: new ObjectId(eventId) })
      if (!foundSetting) {
        return
      }

      const voteBlockIndex = blocks.findIndex((block: any) => {
        return block.elements?.[0].value === value
      })

      const userProfile = await slackApi.users.info({
        user: payload.user.id,
      })
      const profilePic = userProfile.user?.profile?.image_48
      const name = userProfile.user?.real_name

      try {
        // Get votes and check if it's already voted by the user
        const votes = foundSetting.votes || []
        const externalVotes = foundSetting.externalVotes || []
        const hasVoted = votes.some((vote: any) => vote.userId === payload.user.id && vote.value === value)

        // If voted, remove the vote
        let newVotes = []
        if (hasVoted) {
          newVotes = votes.filter((vote: any) => vote.userId !== payload.user.id)
          await eventCollection.updateOne({ _id: new ObjectId(eventId) }, { $set: { votes: newVotes } }, { session })
        } else {
          // If not voted, add the vote
          newVotes = [...votes, { userId: payload.user.id, name, profilePic, value }]
          await eventCollection.updateOne({ _id: new ObjectId(eventId) }, { $set: { votes: newVotes } }, { session })
        }

        const filteredVotes = newVotes.filter((vote: any) => vote.value === value)
        const filtredExternalVotes = externalVotes.filter((vote: any) => vote.value === value)
        const voteCount = (filteredVotes.length || 0) + (filtredExternalVotes.length || 0)

        const limits = foundSetting.limits
          .map((limit: any) => parseInt(limit.value))
          .sort((a: number, b: number) => a - b)

        const emoji = limits.length
          ? limits.some(limit => limit === filteredVotes.length)
            ? ':white_check_mark: '
            : ':x: '
          : undefined

        const limittext = limits.length ? ` (${limits.join(', ')})` : ''
        const newVoteBlocks = [
          {
            'type': 'plain_text',
            'emoji': true,
            'text': `${emoji}${voteCount} votes${limittext}`,
          },
          // ORder by vote timestamp
          ...[...filteredVotes, ...filtredExternalVotes].map(vote => ({
            'type': 'image',
            'image_url': vote.profilePic,
            'alt_text': vote.name,
          })),
        ]

        blocks[voteBlockIndex + 1] = {
          ...blocks[voteBlockIndex + 1],
          elements: newVoteBlocks,
        }

        await session.commitTransaction()
        session.endSession()
      } catch (error) {
        await session.abortTransaction()
        session.endSession()
        throw error
      }

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

    const usersCollection = db.collection('users')

    const users = await usersCollection.find().toArray()

    const userDropdown =
      users.length === 0
        ? []
        : [
            {
              'type': 'header',
              'text': {
                'type': 'plain_text',
                'text': 'Add existing user',
                'emoji': true,
              },
            },
            {
              'type': 'input',
              'element': {
                'type': 'static_select',
                'placeholder': {
                  'type': 'plain_text',
                  'text': 'Select user',
                  'emoji': true,
                },
                'options': users.map(user => ({
                  'text': {
                    'type': 'plain_text',
                    'text': `${user.name} (${user.email})`,
                    'emoji': true,
                  },
                  'value': JSON.stringify(user),
                })),
                'action_id': 'event-recurring',
              },
              'label': {
                'type': 'plain_text',
                'text': 'Recurring (optional)',
                'emoji': true,
              },
            },
            {
              'type': 'divider',
            },
            {
              'type': 'rich_text',
              'elements': [
                {
                  'type': 'rich_text_section',
                  'elements': [
                    {
                      'type': 'text',
                      'text': "Can't find the user you're looking for?",
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
                    'text': 'Add new user instead',
                    'emoji': true,
                  },
                  'action_id': 'plus-one-add-new-user-action',
                },
              ],
            },
          ]

    const createNewUser =
      users.length !== 0
        ? []
        : [
            {
              'type': 'header',
              'text': {
                'type': 'plain_text',
                'text': 'Create new user',
                'emoji': true,
              },
            },
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
          ]

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
        private_metadata: JSON.stringify({
          eventId: payload.actions[0].value,
          ts: payload.message.ts,
          channelId: payload.channel.id,
          //blocks: payload.message.blocks,
        }),
        'close': {
          'type': 'plain_text',
          'text': 'Cancel',
          'emoji': true,
        },
        'blocks': [...userDropdown, ...createNewUser],
      },
    })
  },

  updateOutsiderModal: async (payload: any) => {
    await slackApi.views.update({
      view_id: payload.view.id,
      view: {
        private_metadata: payload.view.private_metadata,
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
            'type': 'header',
            'text': {
              'type': 'plain_text',
              'text': 'Create new user',
              'emoji': true,
            },
          },
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

  addOutsider: async (payload: any, res: Response) => {
    const { values: formValues } = payload.view.state

    let name, email

    if (Object.values(formValues).length === 2) {
      const [nameObj, emailObj] = Object.values(formValues)
      name = nameObj['plus1-name']['value']
      email = emailObj['plus1-email']['value']
    } else {
      const [dropdownObj] = Object.values(formValues)
      const { name: _name, email: _email } = JSON.parse(dropdownObj['event-recurring']['selected_option'].value)
      name = _name
      email = _email
    }

    const dbObject = {
      name,
      email,
    }

    const usersCollection = db.collection('users')

    let user = await usersCollection.findOne({ email })

    if (!user) {
      const newUserId = await usersCollection.insertOne(dbObject)
      user = { _id: newUserId.insertedId, ...dbObject }
    }

    const eventInfo = JSON.parse(payload.view.private_metadata)

    const eventsCollection = db.collection('events')
    const eventIdObj = JSON.parse(eventInfo.eventId)

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventIdObj.eventId) })
    if (!event) {
      return res.send()
    }
    const userProfile = await slackApi.users.info({
      user: payload.user.id,
    })
    const profilePic = userProfile.user?.profile?.image_48

    const hasVoted = (event.externalVotes || []).some(
      (vote: any) => vote.userId === user._id && vote.value === eventIdObj.option
    )
    let newExternalVotes = []
    if (!hasVoted) {
      newExternalVotes = [
        ...(event.externalVotes || []),
        { userId: user._id, name: user.name, profilePic: profilePic, value: eventIdObj.option },
      ]

      await eventsCollection.updateOne(
        { _id: new ObjectId(eventIdObj.eventId) },
        { $set: { externalVotes: newExternalVotes } }
      )
    } else {
      // TODO törölni ha már szavazott
    }

    const message = await slackApi.conversations.history({
      channel: eventInfo.channelId,
      latest: eventInfo.ts,
      limit: 1,
      inclusive: true,
    })

    if (!message.ok) {
      return res.send()
    }
    const blocks = message.messages?.[0].blocks
    const voteBlockIndex = blocks.findIndex((block: any) => {
      return block.elements?.[0].value === eventIdObj.option
    })

    const filteredVotes = event.votes?.filter((vote: any) => vote.value === eventIdObj.option) || []
    const filtredExternalVotes = newExternalVotes?.filter((vote: any) => vote.value === eventIdObj.option) || []
    const voteCount = (filteredVotes.length || 0) + (filtredExternalVotes.length || 0)

    const limits = event.limits.map((limit: any) => parseInt(limit.value)).sort((a: number, b: number) => a - b)

    const emoji = limits.length
      ? limits.some(limit => limit === filteredVotes.length)
        ? ':white_check_mark: '
        : ':x: '
      : undefined

    const limittext = limits.length ? ` (${limits.join(', ')})` : ''
    const newVoteBlocks = [
      {
        'type': 'plain_text',
        'emoji': true,
        'text': `${emoji}${voteCount} votes${limittext}`,
      },
      // ORder by vote timestamp
      ...[...filteredVotes, ...filtredExternalVotes].map(vote => ({
        'type': 'image',
        'image_url': vote.profilePic,
        'alt_text': vote.name,
      })),
    ]

    blocks[voteBlockIndex + 1] = {
      ...blocks[voteBlockIndex + 1],
      elements: newVoteBlocks,
    }

    console.log('blocks', JSON.stringify(blocks, null, 2))

    await slackApi.chat.update({
      ts: eventInfo.ts,
      channel: eventInfo.channelId,
      blocks: blocks,
    })

    return res.send()
  },

  deleteEvent: async (payload: any) => {
    const toDeleteId = payload.actions[0].value
    const eventCollection = db.collection('events')
    await eventCollection.deleteOne({ _id: new ObjectId(toDeleteId) })
    await slackDomain.appHomeOpened({ user: payload.user.id })
  },

  finishVoting: async (payload: any) => {
    await slackApi.chat.update({
      ts: payload.message.ts,
      channel: payload.channel.id,
      blocks: payload.message.blocks.filter((block: any) => block.type !== 'actions'),
    }) 

    const eventCollection = db.collection('events')
    const event = await eventCollection.findOne({ _id: new ObjectId(payload.actions[0].value) })

    const votes = [...(event.votes || []), ...(event.externalVotes || [])]

    const limits = (event.limits || []).map((limit: any) => parseInt(limit.value))

    const passedOptions = event.options
      .map((option: any) => {
        const filteredVotes = votes.filter((vote: any) => vote.value === option.value)
        const voteCount = filteredVotes.length

        return {
          ...option,
          voteCount,
          voters: filteredVotes,
          passed: event.limits?.length ? limits.some(limit => limit === voteCount) : true,
        }
      })
      .filter((option: any) => option.passed)

    if (!passedOptions.length) {
      await slackApi.chat.postMessage({
        channel: payload.channel.id,
        text: 'No options passed the limit!',
        thread_ts: payload.message.ts,
      })
      return
    }

    const mostVotedOption = passedOptions.reduce((prev: any, current: any) =>
      prev.voteCount > current.voteCount ? prev : current
    )

    // TODO Make groups

    await slackApi.chat.postMessage({
      channel: payload.channel.id,
      text: 'Voting has finished!',
      thread_ts: payload.message.ts,
      blocks: [
        {
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': '*Most voted option*',
          },
        },
        {
          'type': 'divider',
        },
        {
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': mostVotedOption.text.text,
          },
        },
        {
          'type': 'context',
          'elements': [
            {
              'type': 'mrkdwn',
              'text': 'Votes: ' + mostVotedOption.voteCount,
            },
          ],
        },
        {
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': '*Voters*',
          },
        },
        {
          'type': 'divider',
        },
        ...mostVotedOption.voters.map((voter: any) => ({
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': `<@${voter.userId}>`,
          },
        })),
      ],
    })

    await eventCollection.updateOne(
      { _id: new ObjectId(payload.actions[0].value) },
      { $set: { votes: [], externalVotes: [] } }
    )
  },
}

export default slackDomain
