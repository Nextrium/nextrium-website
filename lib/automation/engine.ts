// A small rules engine. A rule pairs a trigger with an action; both are
// plain keys plus JSON settings stored in the automation_rules table, so new
// automations are new rows and, when a new kind of action is needed, one
// handler function registered by its key.

export interface SubjectContext {
  userId: string
  role: string
  isTeamMember: boolean
  archived: boolean
  discordUserId: string | null
  track: string | null
}

export interface Rule {
  id: string
  name: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
}

export interface ActionResult {
  status: 'success' | 'waiting' | 'failed'
  detail: string
}

export type ActionHandler = (ctx: SubjectContext, config: Record<string, unknown>) => Promise<ActionResult>

export interface EngineDeps {
  loadRules(triggerType: string): Promise<Rule[]>
  loadContext(userId: string): Promise<SubjectContext | null>
  hasSuccess(ruleId: string, userId: string): Promise<boolean>
  record(ruleId: string, userId: string, result: ActionResult): Promise<void>
  handlers: Record<string, ActionHandler>
}

export interface RuleOutcome {
  ruleId: string
  ruleName: string
  status: ActionResult['status'] | 'skipped'
  detail: string
}

function asList(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * trigger_config filters (all optional; an empty config matches everyone):
 *   track          one name or a list, compared without case
 *   roles          list of dashboard roles
 *   teamMemberOnly true = only people marked as team members
 */
export function ruleMatches(rule: Pick<Rule, 'trigger_config'>, ctx: SubjectContext): boolean {
  const cfg = rule.trigger_config ?? {}
  const tracks = asList(cfg.track).map((t) => t.trim().toLowerCase())
  if (tracks.length > 0 && !(ctx.track && tracks.includes(ctx.track.trim().toLowerCase()))) return false
  const roles = asList(cfg.roles)
  if (roles.length > 0 && !roles.includes(ctx.role)) return false
  if (cfg.teamMemberOnly === true && !ctx.isTeamMember) return false
  return true
}

/**
 * Runs every enabled rule for this trigger against one person. A rule that
 * has already succeeded for that person is not run again. A handler that
 * throws is recorded as failed and does not stop the other rules.
 */
export async function runEvent(deps: EngineDeps, triggerType: string, userId: string): Promise<RuleOutcome[]> {
  const ctx = await deps.loadContext(userId)
  if (!ctx || ctx.archived) return []

  const outcomes: RuleOutcome[] = []
  for (const rule of await deps.loadRules(triggerType)) {
    if (!ruleMatches(rule, ctx)) continue

    if (await deps.hasSuccess(rule.id, userId)) {
      outcomes.push({ ruleId: rule.id, ruleName: rule.name, status: 'skipped', detail: 'Already done.' })
      continue
    }

    const handler = deps.handlers[rule.action_type]
    let result: ActionResult
    if (!handler) {
      result = { status: 'failed', detail: `No handler is registered for "${rule.action_type}".` }
    } else {
      try {
        result = await handler(ctx, rule.action_config ?? {})
      } catch (err) {
        result = { status: 'failed', detail: err instanceof Error ? err.message : 'The action failed.' }
      }
    }

    try {
      await deps.record(rule.id, userId, result)
    } catch (err) {
      console.error('[automation] could not record result:', err instanceof Error ? err.message : err)
    }
    outcomes.push({ ruleId: rule.id, ruleName: rule.name, status: result.status, detail: result.detail })
  }
  return outcomes
}
