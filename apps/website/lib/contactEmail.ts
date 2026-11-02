import { brand } from '@nextrium/brand'
import { escapeHtml as h } from '@nextrium/contributions-core/emails'

const C = brand.colors

const SUBJECT_LABELS: Record<string, string> = {
  services:    'Services enquiry',
  partnership: 'Partnership enquiry',
  investment:  'Investment enquiry',
  press:       'Press enquiry',
  general:     'General enquiry',
}

export interface ContactFields {
  firstName: string
  lastName: string
  email: string
  organisation?: string | null
  subjectType?: unknown
  message: string
}

// Line breaks can't appear in an email subject or a sender name.
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim()

/** Builds the staff notification. Every sender-supplied value is escaped here. */
export function buildContactEmail(fields: ContactFields): { subject: string; replyName: string; html: string } {
  const firstName = fields.firstName.trim()
  const fullName = oneLine(`${firstName} ${fields.lastName.trim()}`)
  const email = fields.email.trim()
  const organisation = fields.organisation?.trim()
  const subjectLabel = typeof fields.subjectType === 'string' && Object.hasOwn(SUBJECT_LABELS, fields.subjectType)
    ? SUBJECT_LABELS[fields.subjectType]
    : 'New enquiry'
  const mailto = `mailto:${encodeURIComponent(email)}`

  return {
    subject: `[${brand.styledName}] ${subjectLabel} from ${fullName}`,
    replyName: fullName,
    html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: ${C['--navy-deep']}; color: ${C['--off-white']};">
            <div style="border-bottom: 2px solid ${C['--orange']}; padding-bottom: 16px; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 20px; color: #ffffff;">New contact submission</h2>
              <p style="margin: 4px 0 0; font-size: 12px; color: ${C['--grey-mid']}; text-transform: uppercase; letter-spacing: 0.1em;">${subjectLabel}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px; width: 120px;">Name</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--off-white']}; font-size: 14px;">${h(fullName)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--orange']}; font-size: 14px;"><a href="${h(mailto)}" style="color: ${C['--orange']};">${h(email)}</a></td>
              </tr>
              ${organisation ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px;">Organisation</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--off-white']}; font-size: 14px;">${h(organisation)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px;">Subject</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--off-white']}; font-size: 14px;">${subjectLabel}</td>
              </tr>
            </table>
            <div style="background: ${C['--navy']}; padding: 20px; border-left: 3px solid ${C['--orange']};">
              <p style="margin: 0 0 8px; color: ${C['--grey-mid']}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Message</p>
              <p style="margin: 0; color: ${C['--off-white']}; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${h(fields.message.trim())}</p>
            </div>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);">
              <a href="${h(`${mailto}?subject=${encodeURIComponent(`Re: Your message to ${brand.styledName}`)}`)}" style="display: inline-block; padding: 12px 24px; background: ${C['--orange']}; color: #ffffff; text-decoration: none; font-size: 13px;">Reply to ${h(firstName)} →</a>
            </div>
            <p style="margin-top: 24px; font-size: 11px; color: ${C['--grey-mid']};">This message was submitted via ${brand.urls.websiteDisplay}/contact</p>
          </div>
        `,
  }
}
