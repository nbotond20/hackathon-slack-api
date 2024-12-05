import { string, object, boolean, array, z } from 'zod'

const confirmSchema = object({
  confirm: object({
    emoji: boolean(),
    text: string(),
    type: string(),
  }),
  deny: object({
    emoji: boolean(),
    text: string(),
    type: string(),
  }),
  text: object({
    emoji: boolean(),
    text: string(),
    type: string(),
  }),
  title: object({
    emoji: boolean(),
    text: string(),
    type: string(),
  }),
})

const actionSchema = object({
  action_id: string(),
  action_ts: string(),
  block_id: string(),
  confirm: confirmSchema.optional(),
  style: string().optional(),
  text: object({
    emoji: boolean(),
    text: string(),
    type: string(),
  }),
  type: string(),
  value: string().optional(),
})

const channelSchema = object({
  id: string(),
  name: string(),
}).optional()

const containerSchema = object({
  channel_id: string(),
  is_ephemeral: boolean(),
  message_ts: string(),
  type: string(),
})

const messageSchema = object({
  app_id: string(),
  blocks: array(
    object({
      type: string(),
      elements: array(object({})).optional(),
      block_id: string(),
    }).passthrough()
  ).optional(),
  bot_id: string(),
  team: string(),
  text: string(),
  ts: string(),
  type: string(),
  user: string(),
}).optional()

const stateSchema = object({
  values: object({}),
}).optional()

const teamSchema = object({
  domain: string(),
  id: string(),
})

export const slackActionPayloadSchema = object({
  actions: array(actionSchema),
  api_app_id: string(),
  channel: channelSchema,
  container: containerSchema,
  enterprise: object({}).nullable(),
  is_enterprise_install: boolean(),
  message: messageSchema,
  response_url: string().optional(),
  state: stateSchema,
  team: teamSchema,
  token: string(),
  trigger_id: string(),
  type: string(),
  user: object({
    id: string(),
    name: string(),
    team_id: string(),
    username: string(),
  }),
}).passthrough()

export type SlackActionPayload = z.infer<typeof slackActionPayloadSchema>
export type Action = z.infer<typeof actionSchema>

export const slackApiErrorSchema = object({
  code: string(),
  data: object({
    error: string(),
    ok: boolean(),
  }),
}).passthrough()

export type SlackApiError = z.infer<typeof slackApiErrorSchema>
