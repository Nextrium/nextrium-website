'use client'

import { useState } from 'react'
import SectionTag from '@/components/shared/SectionTag'

type Subject = 'services' | 'partnership' | 'investment' | 'press' | 'general'

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'services',    label: 'I want to build something'        },
  { value: 'partnership', label: 'I want to partner or collaborate' },
  { value: 'investment',  label: 'Investment or funding'            },
  { value: 'press',       label: 'Press or media enquiry'           },
  { value: 'general',     label: 'Something else'                   },
]

const CONTACT_INFO = [
  { label: 'Email',    value: 'hello@nextrium.org',    href: 'mailto:hello@nextrium.org'      },
  { label: 'Website',  value: 'nextrium.org',               href: 'https://nextrium.org'                },
  { label: 'GitHub',   value: 'github.com/Next-Trend-Lab', href: 'https://github.com/Next-Trend-Lab'   },
  { label: 'Location', value: 'Lagos, Nigeria',             href: null                                  },
]

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactClient() {
  const [subject, setSubject] = useState<Subject>('general')
  const [formState, setFormState] = useState<FormState>('idle')

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('submitting')

    const form = e.currentTarget
    const data = {
      first_name:   (form.elements.namedItem('first_name')   as HTMLInputElement)?.value ?? '',
      last_name:    (form.elements.namedItem('last_name')    as HTMLInputElement)?.value ?? '',
      email:        (form.elements.namedItem('email')        as HTMLInputElement)?.value ?? '',
      organisation: (form.elements.namedItem('organisation') as HTMLInputElement)?.value ?? '',
      message:      (form.elements.namedItem('message')      as HTMLTextAreaElement)?.value ?? '',
      subject_type: subject,
    }

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong.')
      setFormState('success')
    } catch (err) {
      setFormState('error')
      console.error(err)
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .contact-hero {
          background: var(--navy-deep);
          padding-top: calc(var(--nav-height) + 80px);
          padding-bottom: 80px;
          position: relative; overflow: hidden;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .contact-hero-glow {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 50% 60% at 88% 10%, rgba(219,103,39,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 40% 50% at 5% 90%, rgba(10,139,139,0.07) 0%, transparent 50%);
        }
        .contact-hero-grid {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
          background-image:
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .contact-hero-inner {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 80px; align-items: end;
        }
        .contact-headline {
          font-family: var(--font-exo2); font-weight: 900;
          font-size: clamp(48px, 8vw, 88px);
          line-height: 0.95; letter-spacing: -2.5px;
          color: var(--white); margin-bottom: 0;
          animation: fadeUp 0.7s ease both; animation-delay: 0.1s;
        }
        .contact-headline em { font-style: normal; color: var(--orange); }
        .contact-hero-right {
          animation: fadeUp 0.7s ease both; animation-delay: 0.25s; padding-bottom: 8px;
        }
        .contact-hero-desc {
          font-weight: 300; font-size: clamp(15px, 1.6vw, 18px);
          color: var(--grey-mid); line-height: 1.75; margin-bottom: 32px;
        }
        .contact-info-list { display: flex; flex-direction: column; gap: 0; }
        .contact-info-row {
          display: grid; grid-template-columns: 100px 1fr;
          gap: 16px; padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .contact-info-row:first-child { border-top: 1px solid rgba(255,255,255,0.06); }
        .contact-info-label {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--grey-mid); padding-top: 2px;
        }
        .contact-info-value {
          font-size: 14px; color: var(--off-white); text-decoration: none;
          transition: color var(--transition-base);
        }
        a.contact-info-value:hover { color: var(--orange); }
        .contact-form-section { background: var(--off-white); padding: var(--section-py) 0; }
        .contact-form-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 80px; align-items: start;
        }
        .contact-form-title {
          font-family: var(--font-exo2); font-weight: 800;
          font-size: clamp(28px, 3.5vw, 44px); color: var(--navy-deep);
          letter-spacing: -1px; line-height: 1.05; margin-bottom: 16px;
        }
        .contact-form-title em { font-style: normal; color: var(--orange); }
        .contact-form-desc { font-size: 15px; color: var(--grey-dark); line-height: 1.75; }
        .subject-selector { display: flex; flex-direction: column; gap: 2px; margin-bottom: 32px; }
        .subject-btn {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 14px 20px;
          border: 1px solid var(--grey-light);
          background: var(--white); color: var(--grey-dark);
          font-family: var(--font-dm); font-size: 14px;
          cursor: pointer; text-align: left;
          transition: all var(--transition-base);
        }
        .subject-btn:hover { border-color: var(--navy); color: var(--navy-deep); }
        .subject-btn.active { background: var(--navy-deep); color: var(--white); border-color: var(--navy-deep); }
        .subject-btn-indicator {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          border: 1px solid var(--grey-mid);
          transition: background var(--transition-base), border-color var(--transition-base);
        }
        .subject-btn.active .subject-btn-indicator { background: var(--orange); border-color: var(--orange); }
        .contact-form { display: flex; flex-direction: column; gap: 20px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-label {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-dark);
        }
        .form-input {
          background: var(--white); border: 1px solid var(--grey-light);
          color: var(--navy-deep); font-family: var(--font-dm); font-size: 14px;
          padding: 12px 16px; outline: none;
          transition: border-color var(--transition-base);
        }
        .form-input:focus { border-color: var(--navy); }
        .form-input::placeholder { color: var(--grey-mid); }
        .form-textarea { resize: vertical; min-height: 120px; }
        .form-submit {
          font-family: var(--font-dm); font-size: 14px; font-weight: 400;
          color: var(--white); background: var(--orange);
          border: 1px solid var(--orange); padding: 16px 24px;
          cursor: pointer; transition: background var(--transition-base);
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .form-submit:hover:not(:disabled) { background: var(--orange-f); }
        .form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .success-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(7,22,40,0.92);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 0.3s ease;
        }
        .success-modal {
          background: var(--navy);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 56px 48px;
          max-width: 480px; width: 100%;
          position: relative; overflow: hidden;
          animation: fadeUp 0.4s ease both;
        }
        .success-modal-corner-tl {
          position: absolute; top: -1px; left: -1px;
          width: 20px; height: 20px;
          border-top: 2px solid var(--orange); border-left: 2px solid var(--orange);
        }
        .success-modal-corner-br {
          position: absolute; bottom: -1px; right: -1px;
          width: 20px; height: 20px;
          border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange);
        }
        .success-modal-icon {
          width: 56px; height: 56px;
          background: rgba(34,193,122,0.1); border: 1px solid rgba(34,193,122,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: var(--success); margin-bottom: 24px;
        }
        .success-modal-title {
          font-family: var(--font-exo2); font-weight: 800;
          font-size: 32px; color: var(--white);
          letter-spacing: -1px; line-height: 1.05; margin-bottom: 16px;
        }
        .success-modal-desc {
          font-size: 15px; color: var(--grey-mid);
          line-height: 1.75; margin-bottom: 32px;
        }
        .success-modal-close {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.15em; text-transform: uppercase;
          padding: 12px 24px; background: var(--orange);
          border: 1px solid var(--orange); color: var(--white);
          cursor: pointer; transition: background 0.15s ease;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .success-modal-close:hover { background: var(--orange-f, #C4521A); }
        .other-ways-section { background: var(--navy); padding: var(--section-py) 0; }
        .other-ways-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: rgba(255,255,255,0.06);
        }
        .other-way-card {
          background: var(--navy-mid); padding: 40px 32px;
          display: flex; flex-direction: column; gap: 16px; position: relative;
        }
        .other-way-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--orange); transform: scaleX(0); transform-origin: left;
          transition: transform var(--transition-slow);
        }
        .other-way-card:hover::before { transform: scaleX(1); }
        .other-way-tag {
          font-family: var(--font-mono); font-size: 8.5px;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--orange);
        }
        .other-way-title {
          font-family: var(--font-exo2); font-weight: 700;
          font-size: 20px; color: var(--white); letter-spacing: -0.2px;
        }
        .other-way-desc { font-size: 13px; color: var(--grey-mid); line-height: 1.7; flex: 1; }
        .other-way-link {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--orange); text-decoration: none;
          transition: color var(--transition-base);
          display: flex; align-items: center; gap: 8px;
        }
        .other-way-link:hover { color: var(--orange-w); }
        @media (max-width: 900px) {
          .contact-hero-inner  { grid-template-columns: 1fr; gap: 40px; }
          .contact-form-grid   { grid-template-columns: 1fr; gap: 48px; }
          .other-ways-grid     { grid-template-columns: 1fr; }
          .form-row            { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .contact-info-row { grid-template-columns: 1fr; gap: 2px; }
        }
      `}</style>

      <section className="contact-hero">
        <div className="contact-hero-glow" />
        <div className="contact-hero-grid" />
        <div className="container">
          <div className="contact-hero-inner">
            <div>
              <SectionTag label="Get in touch" />
              <h1 className="contact-headline">
                Let&apos;s build<br />something<br /><em>together.</em>
              </h1>
            </div>
            <div className="contact-hero-right">
              <p className="contact-hero-desc">
                We respond to every message within two business days. No automated replies, no templates. A real person reads your message and gets back to you.
              </p>
              <div className="contact-info-list">
                {CONTACT_INFO.map((item) => (
                  <div key={item.label} className="contact-info-row">
                    <span className="contact-info-label">{item.label}</span>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="contact-info-value"
                        target={item.href.startsWith('http') ? '_blank' : undefined}
                        rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {item.value}
                      </a>
                    ) : (
                      <span className="contact-info-value">{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="container">
          <div className="contact-form-grid">
            <div>
              <SectionTag label="Send a message" />
              <div className="contact-form-title">
                What are you<br /><em>reaching out about?</em>
              </div>
              <p className="contact-form-desc">
                Select the option that best describes your enquiry. It helps us route your message to the right person.
              </p>
              <div style={{ marginTop: '32px' }}>
                <div className="subject-selector">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`subject-btn ${subject === s.value ? 'active' : ''}`}
                      onClick={() => setSubject(s.value)}
                    >
                      <span>{s.label}</span>
                      <span className="subject-btn-indicator" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <form className="contact-form" onSubmit={handleSubmit} noValidate>
                <input type="hidden" name="subject_type" value={subject} />
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="first_name">First name</label>
                    <input className="form-input" id="first_name" name="first_name" type="text" placeholder="First name" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="last_name">Last name</label>
                    <input className="form-input" id="last_name" name="last_name" type="text" placeholder="Last name" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email address</label>
                  <input className="form-input" id="email" name="email" type="email" placeholder="your@email.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="organisation">Organisation (optional)</label>
                  <input className="form-input" id="organisation" name="organisation" type="text" placeholder="Company or project name" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="message">Message</label>
                  <textarea
                    className="form-input form-textarea" id="message" name="message"
                    placeholder="Tell us what you are building or what you need. The more detail, the better."
                    required
                  />
                </div>
                <button type="submit" className="form-submit" disabled={formState === 'submitting'}>
                  <span>{formState === 'submitting' ? 'Sending...' : formState === 'error' ? 'Try again' : 'Send message'}</span>
                  <span>{formState === 'submitting' ? '...' : '→'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="other-ways-section">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <SectionTag label="Other ways to connect" />
            <h2 className="section-title">Not ready to send<br />a message yet?</h2>
          </div>
          <div className="other-ways-grid">
            <div className="other-way-card">
              <span className="other-way-tag">Careers</span>
              <div className="other-way-title">Join the team</div>
              <p className="other-way-desc">
                We are a small team building products for underserved markets. If you want to work on things that matter, check our open roles.
              </p>
              <a href="/careers" className="other-way-link">View open roles →</a>
            </div>
            <div className="other-way-card">
              <span className="other-way-tag">Hub</span>
              <div className="other-way-title">Join the community</div>
              <p className="other-way-desc">
                The NexTrium Hub runs hackathons, workshops, and build sprints. Get involved in the next event or propose one.
              </p>
              <a href="/hub" className="other-way-link">Explore the Hub →</a>
            </div>
            <div className="other-way-card">
              <span className="other-way-tag">GitHub</span>
              <div className="other-way-title">Follow the builds</div>
              <p className="other-way-desc">
                Our products are being built in the open. Follow along on GitHub and contribute if you see something you can improve.
              </p>
              <a href="https://github.com/Next-Trend-Lab" target="_blank" rel="noopener noreferrer" className="other-way-link">
                View on GitHub →
              </a>
            </div>
          </div>
        </div>
      </section>

      {formState === 'success' && (
        <div className="success-overlay" onClick={() => setFormState('idle')}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-modal-corner-tl" />
            <div className="success-modal-corner-br" />
            <div className="success-modal-icon">✓</div>
            <div className="success-modal-title">Message received.</div>
            <p className="success-modal-desc">
              We will get back to you within two business days. No automated replies — a real person reads every message.
            </p>
            <button
              type="button"
              className="success-modal-close"
              onClick={() => setFormState('idle')}
            >
              <span>Close</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
