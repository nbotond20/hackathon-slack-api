import { ScheduledTask } from 'node-cron'

export const activeJobs: Record<string, ScheduledTask> = {}
