import { NextResponse } from 'next/server'
import { createServiceClient } from '@nextrium/supabase/server'
import { brand } from '@nextrium/brand'

const C = brand.colors

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { first_name, last_name, email, organisation, subject_type, message } = body

    if (!first_name?.trim()) return NextResponse.json({ error: 'First name is required.' }, { status: 400 })
    if (!last_name?.trim())  return NextResponse.json({ error: 'Last name is required.' },  { status: 400 })
    if (!email?.trim())      return NextResponse.json({ error: 'Email is required.' },       { status: 400 })
    if (!message?.trim())    return NextResponse.json({ error: 'Message is required.' },     { status: 400 })

    const supabase = createServiceClient()
    const { error: dbError } = await (supabase.from('contact_submissions') as any).insert({
      first_name:   first_name.trim(),
      last_name:    last_name.trim(),
      email:        email.trim(),
      organisation: organisation?.trim() || null,
      subject_type: subject_type ?? 'general',
      message:      message.trim(),
      status:       'new',
    })

    if (dbError) throw new Error(dbError.message)

    const subjectLabels: Record<string, string> = {
      services:    'Services enquiry',
      partnership: 'Partnership enquiry',
      investment:  'Investment enquiry',
      press:       'Press enquiry',
      general:     'General enquiry',
    }
    const subjectLabel = subjectLabels[subject_type] ?? 'New enquiry'

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key':      process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender:  { name: `${brand.styledName} Website`, email: process.env.BREVO_SENDER_EMAIL! },
        to:      [{ email: brand.emails.hello, name: brand.styledName }],
        replyTo: { email: email.trim(), name: `${first_name.trim()} ${last_name.trim()}` },
        subject: `[${brand.styledName}] ${subjectLabel} from ${first_name.trim()} ${last_name.trim()}`,
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: ${C['--navy-deep']}; color: ${C['--off-white']};">
            <div style="border-bottom: 2px solid ${C['--orange']}; padding-bottom: 16px; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 20px; color: #ffffff;">New contact submission</h2>
              <p style="margin: 4px 0 0; font-size: 12px; color: ${C['--grey-mid']}; text-transform: uppercase; letter-spacing: 0.1em;">${subjectLabel}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px; width: 120px;">Name</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--off-white']}; font-size: 14px;">${first_name.trim()} ${last_name.trim()}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--orange']}; font-size: 14px;"><a href="mailto:${email.trim()}" style="color: ${C['--orange']};">${email.trim()}</a></td>
              </tr>
              ${organisation?.trim() ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px;">Organisation</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--off-white']}; font-size: 14px;">${organisation.trim()}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--grey-mid']}; font-size: 12px;">Subject</td>
                <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); color: ${C['--off-white']}; font-size: 14px;">${subjectLabel}</td>
              </tr>
            </table>
            <div style="background: ${C['--navy']}; padding: 20px; border-left: 3px solid ${C['--orange']};">
              <p style="margin: 0 0 8px; color: ${C['--grey-mid']}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;">Message</p>
              <p style="margin: 0; color: ${C['--off-white']}; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${message.trim()}</p>
            </div>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);">
              <a href="mailto:${email.trim()}?subject=Re: Your message to ${brand.styledName}" style="display: inline-block; padding: 12px 24px; background: ${C['--orange']}; color: #ffffff; text-decoration: none; font-size: 13px;">Reply to ${first_name.trim()} →</a>
            </div>
            <p style="margin-top: 24px; font-size: 11px; color: ${C['--grey-dark']};">This message was submitted via ${brand.urls.websiteDisplay}/contact</p>
          </div>
        `,
      }),
    })

    if (!brevoRes.ok) {
      const brevoError = await brevoRes.json()
      console.error('Brevo error:', brevoError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong.' },
      { status: 500 }
    )
  }
}