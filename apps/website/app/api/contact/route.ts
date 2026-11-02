import { NextResponse } from 'next/server'
import { createServiceClient } from '@nextrium/supabase/server'
import { brand } from '@nextrium/brand'
import { buildContactEmail } from '@/lib/contactEmail'

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

    const notification = buildContactEmail({
      firstName: first_name,
      lastName: last_name,
      email,
      organisation,
      subjectType: subject_type,
      message,
    })

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key':      process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender:  { name: `${brand.styledName} Website`, email: process.env.BREVO_SENDER_EMAIL! },
        to:      [{ email: brand.emails.hello, name: brand.styledName }],
        replyTo: { email: email.trim(), name: notification.replyName },
        subject: notification.subject,
        htmlContent: notification.html,
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