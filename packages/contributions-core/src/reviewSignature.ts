import { createHmac } from 'node:crypto'

/**
 * `X-Zivana-Signature` value for a request body: HMAC-SHA256 of the exact
 * raw body bytes, keyed with the organization's secret, as
 * "sha256=<lowercase hex>". Sign the same string that is sent.
 */
export function signReviewBody(rawBody: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}
