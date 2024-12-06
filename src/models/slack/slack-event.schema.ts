import { z } from 'zod'

// Define the authorizations schema
const authorizationSchema = z.object({
  enterprise_id: z.string(),
  team_id: z.string(),
  user_id: z.string(),
  is_bot: z.boolean(),
  is_enterprise_install: z.boolean(),
})

// Define the event schema
const eventSchema = z
  .object({
    type: z.string(),
    event_ts: z.string(), // you may want to change this to z.number() if it's a timestamp in seconds
    user: z.string(),
    // Include additional fields if necessary
  })
  .passthrough()

// Define the main schema
const eventCallbackSchema = z.object({
  type: z.literal('event_callback'),
  token: z.string(),
  team_id: z.string(),
  api_app_id: z.string(),
  event: eventSchema,
  event_context: z.string(),
  event_id: z.string(),
  event_time: z.number(),
  authorizations: z.array(authorizationSchema),
  is_ext_shared_channel: z.boolean(),
  context_team_id: z.string(),
  context_enterprise_id: z.string().nullable(),
})

// Type definition based on the schema
export type SlackEventCallback = z.infer<typeof eventCallbackSchema>
