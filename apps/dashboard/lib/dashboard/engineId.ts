// IDs placed in an agents-engine URL path must stay one path segment. Encoding
// alone isn't enough, because ".." is unchanged by encodeURIComponent.
export function isEngineId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
}
