// Contributor program constants. The database enforces the same values
// (check constraints and functions), and the review service accepts exactly
// these categories and complexities, so change them in all three together.

export const CATEGORIES = ['technical', 'design', 'research', 'operations', 'community'] as const
export type Category = (typeof CATEGORIES)[number]

export const COMPLEXITIES = ['small', 'medium', 'large'] as const
export type Complexity = (typeof COMPLEXITIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  technical: 'Technical',
  design: 'Design',
  research: 'Research',
  operations: 'Operations',
  community: 'Community',
}

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

/** Base points a verified task can earn, by category and complexity. */
export const POINT_RANGES: Record<Category, Record<Complexity, { min: number; max: number }>> = {
  technical:  { small: { min: 50, max: 120 }, medium: { min: 150, max: 280 }, large: { min: 300, max: 500 } },
  design:     { small: { min: 30, max: 80 },  medium: { min: 80, max: 160 },  large: { min: 180, max: 300 } },
  research:   { small: { min: 50, max: 100 }, medium: { min: 100, max: 200 }, large: { min: 200, max: 400 } },
  operations: { small: { min: 30, max: 60 },  medium: { min: 80, max: 150 },  large: { min: 150, max: 200 } },
  community:  { small: { min: 10, max: 30 },  medium: { min: 60, max: 120 },  large: { min: 100, max: 150 } },
}

/** Days from assignment to deadline, by complexity. */
export const DEADLINE_DAYS: Record<Complexity, number> = { small: 3, medium: 6, large: 12 }

/** Days a granted extension adds, by complexity (one extension per task). */
export const EXTENSION_DAYS: Record<Complexity, number> = { small: 1, medium: 2, large: 3 }

/** Verified contributions needed before the consistency bonus applies. */
export const CONSISTENCY_BONUS_THRESHOLD = 5
export const CONSISTENCY_BONUS_MULTIPLIER = 1.2

export const TASK_STATUSES = ['draft', 'assigned', 'submitted', 'changes_requested', 'completed', 'cancelled'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const CONTRIBUTION_STATUSES = [
  'pending_review',     // saved, service call in flight
  'review_failed',      // service timed out / rate-limited / errored — staff retry
  'changes_requested',  // member may resubmit
  'needs_human',        // service escalated, or approved with a security finding
  'ai_approved',        // service approved — awaits staff verification, no points yet
  'verified',           // staff verified — points awarded
  'rejected',           // staff rejected — final
] as const
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number]

export const EXTENSION_STATUSES = ['none', 'requested', 'granted', 'denied'] as const
export type ExtensionStatus = (typeof EXTENSION_STATUSES)[number]

/** Decisions the review service returns (see the service's API contract). */
export const REVIEW_DECISIONS = ['approved', 'rejected', 'human_required'] as const
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

export function isComplexity(value: unknown): value is Complexity {
  return typeof value === 'string' && (COMPLEXITIES as readonly string[]).includes(value)
}

/** Point range and deadline a new task gets from its category and complexity. */
export function taskDefaults(category: Category, complexity: Complexity) {
  const range = POINT_RANGES[category][complexity]
  return { pointRangeMin: range.min, pointRangeMax: range.max, deadlineDays: DEADLINE_DAYS[complexity] }
}
