'use client'

import { useState } from 'react'
import { normalizeUrl, isValidUrl } from '@nextrium/utils/normalizeUrl'

type FormState = 'idle' | 'submitting' | 'success' | 'error'

interface ProjectLink {
  url: string
  description: string
}

interface FormData {
  name: string
  email: string
  phone: string
  location: string
  role_title: string
  linkedin_url: string
  portfolio_url: string
  github_url: string
  design_url: string
  published_work_url: string
  project_links: ProjectLink[]
  cover_note: string
  currently_building: string
  cv: File | null
  pledge: boolean[]
}

const PLEDGE_POINTS = [
  'I have read and understood that NexTrium is pre-revenue and compensation is deferred.',
  'I understand that my contribution will be formally documented and recognised.',
  'I agree to keep all internal product, technical, and strategic information confidential.',
  'I understand that intellectual property created during my contribution belongs to NexTrium unless separately agreed in writing.',
  'I am applying because I believe in the mission, not because I expect immediate financial return.',
  'I understand that this is a Founding Team Contributor role and carries no co-founder status, equity, or shareholding.',
]

export default function CareersApplicationForm({
  roleId,
  roleTeam,
}: {
  roleId?: string
  roleTeam?: string
}) {
  const [modalOpen,  setModalOpen]  = useState(false)
  const [step,       setStep]       = useState(1)
  const [formState,  setFormState]  = useState<FormState>('idle')
  const [errors,     setErrors]     = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string>('')

  const isEngineering = roleTeam === 'Engineering'
  const isDesign      = roleTeam === 'Product and Design'
  const isResearch    = roleTeam === 'Research and Strategy'
  const totalSteps    = 4

  const [data, setData] = useState<FormData>({
    name: '', email: '', phone: '', location: '', role_title: '',
    linkedin_url: '', portfolio_url: '', github_url: '', design_url: '',
    published_work_url: '',
    project_links: [{ url: '', description: '' }],
    cover_note: '', currently_building: '', cv: null,
    pledge: new Array(PLEDGE_POINTS.length).fill(false),
  })

  function set(field: keyof FormData, value: unknown) {
    setData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function addProjectLink() {
    if (data.project_links.length < 3) {
      set('project_links', [...data.project_links, { url: '', description: '' }])
    }
  }

  function updateProjectLink(i: number, field: 'url' | 'description', value: string) {
    const updated = [...data.project_links]
    updated[i][field] = value
    set('project_links', updated)
  }

  function removeProjectLink(i: number) {
    set('project_links', data.project_links.filter((_, idx) => idx !== i))
  }

  function togglePledge(i: number) {
    const updated = [...data.pledge]
    updated[i] = !updated[i]
    set('pledge', updated)
  }

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!data.name.trim())     e.name     = 'Full name is required.'
      if (!data.email.trim())    e.email    = 'Email address is required.'
      if (!data.location.trim()) e.location = 'Location is required.'
      if (!roleId && !data.role_title.trim()) e.role_title = 'Please tell us what you do.'
    }
    if (s === 2) {
      const urlFields: [keyof FormData, string][] = [
        ['linkedin_url',       'LinkedIn link'],
        ['portfolio_url',      'Portfolio link'],
        ['github_url',         'GitHub link'],
        ['design_url',         'Design portfolio link'],
        ['published_work_url', 'Published work link'],
      ]
      for (const [field, label] of urlFields) {
        const raw = data[field] as string
        if (raw.trim() && !isValidUrl(raw)) e[field] = `${label} doesn't look like a valid URL.`
      }
      data.project_links.forEach((link, i) => {
        if (link.url.trim() && !isValidUrl(link.url)) e[`project_link_${i}`] = 'This project link doesn’t look like a valid URL.'
      })
    }
    if (s === 3) {
      if (!data.cover_note.trim())        e.cover_note        = 'Please tell us why NexTrium.'
      if (!data.currently_building.trim()) e.currently_building = 'Please tell us what you are learning or building.'
    }
    if (s === 4) {
      if (!data.pledge.every(Boolean)) e.pledge = 'Please confirm all six points before submitting.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, totalSteps))
  }

  function back() {
    setErrors({})
    setStep((s) => Math.max(s - 1, 1))
  }

  function openModal() {
    setStep(1)
    setFormState('idle')
    setErrors({})
    setModalOpen(true)
  }

  function closeModal() {
    if (formState === 'submitting') return
    setModalOpen(false)
  }

  async function handleSubmit() {
    if (!validateStep(4)) return
    setFormState('submitting')
    setSubmitError('')

    const fd = new FormData()
    if (roleId) fd.append('role_id', roleId)
    fd.append('name',               data.name)
    fd.append('email',              data.email)
    fd.append('phone',              data.phone)
    fd.append('location',           data.location)
    fd.append('role_title',         data.role_title || roleId || '')
    fd.append('linkedin_url',       normalizeUrl(data.linkedin_url))
    fd.append('portfolio_url',      normalizeUrl(data.portfolio_url))
    fd.append('github_url',         normalizeUrl(data.github_url))
    fd.append('design_url',         normalizeUrl(data.design_url))
    fd.append('published_work_url', normalizeUrl(data.published_work_url))
    fd.append('cover_note',         data.cover_note)
    fd.append('currently_building', data.currently_building)
    data.project_links.filter((l) => l.url.trim()).forEach((l, i) => {
      fd.append(`project_link_${i + 1}_url`,  normalizeUrl(l.url))
      fd.append(`project_link_${i + 1}_desc`, l.description)
    })
    if (data.cv) fd.append('cv', data.cv)

    try {
      const res  = await fetch('/api/applications', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Something went wrong. Please try again.')
        setFormState('error')
        return
      }
      setFormState('success')
    } catch {
      setSubmitError('Something went wrong. Please try again.')
      setFormState('error')
    }
  }

  const stepLabels = ['About you', 'Your work', 'Your application', 'Confirm']

  return (
    <>
      <style>{`
        .apply-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); font-family: var(--font-dm); font-size: 14px; cursor: pointer; transition: background 0.15s ease; width: 100%; }
        .apply-trigger:hover { background: var(--orange-f, #C4521A); }

        .app-modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(7,22,40,0.88); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .app-modal { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); width: 100%; max-width: 640px; max-height: 90vh; display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .app-modal-corner-tl { position: absolute; top: -1px; left: -1px; width: 20px; height: 20px; border-top: 2px solid var(--orange); border-left: 2px solid var(--orange); z-index: 2; }
        .app-modal-corner-br { position: absolute; bottom: -1px; right: -1px; width: 20px; height: 20px; border-bottom: 2px solid var(--orange); border-right: 2px solid var(--orange); z-index: 2; }

        .app-modal-header { padding: 24px 28px 0; flex-shrink: 0; }
        .app-modal-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .app-modal-title { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--white); letter-spacing: -0.3px; }
        .app-modal-close { background: none; border: 1px solid rgba(255,255,255,0.1); color: var(--grey-mid); width: 32px; height: 32px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; flex-shrink: 0; }
        .app-modal-close:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }

        .app-progress { display: flex; align-items: center; gap: 0; margin-bottom: 24px; }
        .app-progress-step { display: flex; align-items: center; gap: 8px; flex: 1; }
        .app-progress-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1); flex-shrink: 0; transition: background 0.2s ease; }
        .app-progress-dot.active { background: var(--orange); }
        .app-progress-dot.done { background: var(--success); }
        .app-progress-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-dark); transition: color 0.2s ease; white-space: nowrap; }
        .app-progress-label.active { color: var(--orange); }
        .app-progress-label.done { color: var(--success); }
        .app-progress-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); margin: 0 8px; }

        .app-modal-body { flex: 1; overflow-y: auto; padding: 0 28px; }
        .app-modal-footer { padding: 20px 28px 24px; flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; gap: 12px; }

        .form-section-desc { font-size: 13px; color: var(--grey-mid); line-height: 1.6; margin-bottom: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .form-label-optional { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; color: var(--grey-dark); margin-left: 8px; }
        .form-input { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; transition: border-color 0.15s ease; width: 100%; }
        .form-input:focus { border-color: var(--orange); }
        .form-input::placeholder { color: var(--grey-dark); }
        .form-textarea { resize: vertical; min-height: 90px; }
        .form-error { font-size: 11px; color: var(--error); margin-top: 2px; }
        .form-error-box { padding: 10px 14px; font-size: 12px; background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.3); color: var(--error); margin-bottom: 16px; }

        .project-link-item { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 10px; }
        .project-link-header { display: flex; align-items: center; justify-content: space-between; }
        .project-link-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .project-link-remove { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--error); background: none; border: none; cursor: pointer; padding: 0; }
        .add-link-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); background: none; border: 1px solid rgba(219,103,39,0.3); padding: 7px 14px; cursor: pointer; transition: all 0.15s ease; }
        .add-link-btn:hover { background: rgba(219,103,39,0.06); border-color: var(--orange); }

        .pledge-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .pledge-item:first-child { border-top: 1px solid rgba(255,255,255,0.06); }
        .pledge-item input[type="checkbox"] { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; accent-color: var(--orange); cursor: pointer; }
        .pledge-item-text { font-size: 13px; color: var(--grey-mid); line-height: 1.6; }
        .pledge-item-text.checked { color: var(--off-white); }

        .nav-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 10px 20px; cursor: pointer; transition: all 0.15s ease; border: 1px solid rgba(255,255,255,0.15); background: none; color: var(--grey-mid); }
        .nav-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
        .nav-btn-primary { background: var(--orange); border-color: var(--orange); color: var(--white); }
        .nav-btn-primary:hover { background: var(--orange-f, #C4521A); border-color: var(--orange-f, #C4521A); }
        .nav-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .success-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 48px 32px; gap: 16px; }
        .success-icon { width: 56px; height: 56px; background: rgba(34,193,122,0.1); border: 1px solid rgba(34,193,122,0.2); display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--success); }
        .success-title { font-family: var(--font-exo2); font-weight: 800; font-size: 28px; color: var(--white); letter-spacing: -0.5px; line-height: 1.1; }
        .success-desc { font-size: 14px; color: var(--grey-mid); line-height: 1.75; max-width: 380px; }

        @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } .app-modal { max-height: 95vh; } .app-progress-label { display: none; } }
      `}</style>

      <button type="button" className="apply-trigger" onClick={openModal}>
        <span>{roleId ? 'Apply for this role' : 'Send an open application'}</span>
        <span>→</span>
      </button>

      {modalOpen && (
        <div className="app-modal-backdrop">
          <div className="app-modal">
            <div className="app-modal-corner-tl" />
            <div className="app-modal-corner-br" />

            {formState === 'success' ? (
              <div className="success-screen">
                <div className="success-icon">✓</div>
                <div className="success-title">Application received.</div>
                <p className="success-desc">
                  We read every application and respond within two weeks. We will be in touch.
                </p>
                <button type="button" className="nav-btn-primary nav-btn" onClick={closeModal}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="app-modal-header">
                  <div className="app-modal-top">
                    <div className="app-modal-title">
                      {roleId ? `Apply` : 'Open application'}
                    </div>
                    <button type="button" className="app-modal-close" onClick={closeModal} aria-label="Close">✕</button>
                  </div>

                  <div className="app-progress">
                    {stepLabels.map((label, i) => {
                      const s        = i + 1
                      const isActive = s === step
                      const isDone   = s < step
                      return (
                        <div key={s} className="app-progress-step">
                          <div className={`app-progress-dot ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} />
                          <span className={`app-progress-label ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>{label}</span>
                          {i < stepLabels.length - 1 && <div className="app-progress-line" />}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="app-modal-body">

                  {formState === 'error' && (
                    <div className="form-error-box">{submitError || 'Something went wrong. Please try again.'}</div>
                  )}

                  {/* Step 1 -- About you */}
                  {step === 1 && (
                    <div style={{ paddingTop: '4px' }}>
                      <p className="form-section-desc">Tell us who you are and where you are based.</p>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="name">Full name</label>
                          <input className="form-input" id="name" type="text" placeholder="Your full name" value={data.name} onChange={(e) => set('name', e.target.value)} />
                          {errors.name && <span className="form-error">{errors.name}</span>}
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="email">Email address</label>
                          <input className="form-input" id="email" type="email" placeholder="your@email.com" value={data.email} onChange={(e) => set('email', e.target.value)} />
                          {errors.email && <span className="form-error">{errors.email}</span>}
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="phone">Phone number <span className="form-label-optional">optional</span></label>
                          <input className="form-input" id="phone" type="tel" placeholder="+234 800 000 0000" value={data.phone} onChange={(e) => set('phone', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="location">Location</label>
                          <input className="form-input" id="location" type="text" placeholder="City, Country" value={data.location} onChange={(e) => set('location', e.target.value)} />
                          {errors.location && <span className="form-error">{errors.location}</span>}
                        </div>
                      </div>
                      {!roleId && (
                        <div className="form-group">
                          <label className="form-label" htmlFor="role_title">What you do</label>
                          <input className="form-input" id="role_title" type="text" placeholder="e.g. Full-stack developer, Product designer" value={data.role_title} onChange={(e) => set('role_title', e.target.value)} />
                          {errors.role_title && <span className="form-error">{errors.role_title}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2 -- Your work */}
                  {step === 2 && (
                    <div style={{ paddingTop: '4px' }}>
                      <p className="form-section-desc">Show us what you have built, written, or contributed to. Everything here is optional but the more you share the better we can understand your work.</p>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label" htmlFor="linkedin_url">LinkedIn <span className="form-label-optional">optional</span></label>
                          <input className="form-input" id="linkedin_url" type="url" placeholder="https://linkedin.com/in/..." value={data.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} />
                          {errors.linkedin_url && <span className="form-error">{errors.linkedin_url}</span>}
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="portfolio_url">Portfolio or website <span className="form-label-optional">optional</span></label>
                          <input className="form-input" id="portfolio_url" type="url" placeholder="https://yoursite.com" value={data.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} />
                          {errors.portfolio_url && <span className="form-error">{errors.portfolio_url}</span>}
                        </div>
                      </div>
                      {isEngineering && (
                        <div className="form-group">
                          <label className="form-label" htmlFor="github_url">GitHub profile <span className="form-label-optional">optional</span></label>
                          <input className="form-input" id="github_url" type="url" placeholder="https://github.com/yourusername" value={data.github_url} onChange={(e) => set('github_url', e.target.value)} />
                          {errors.github_url && <span className="form-error">{errors.github_url}</span>}
                        </div>
                      )}
                      {isDesign && (
                        <div className="form-group">
                          <label className="form-label" htmlFor="design_url">Behance, Dribbble, or Figma <span className="form-label-optional">optional</span></label>
                          <input className="form-input" id="design_url" type="url" placeholder="https://behance.net/..." value={data.design_url} onChange={(e) => set('design_url', e.target.value)} />
                          {errors.design_url && <span className="form-error">{errors.design_url}</span>}
                        </div>
                      )}
                      {isResearch && (
                        <div className="form-group">
                          <label className="form-label" htmlFor="published_work_url">Link to published work <span className="form-label-optional">optional</span></label>
                          <input className="form-input" id="published_work_url" type="url" placeholder="Article, report, paper, or blog post" value={data.published_work_url} onChange={(e) => set('published_work_url', e.target.value)} />
                          {errors.published_work_url && <span className="form-error">{errors.published_work_url}</span>}
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">Relevant project links <span className="form-label-optional">up to 3, optional</span></label>
                        {data.project_links.map((link, i) => (
                          <div key={i} className="project-link-item">
                            <div className="project-link-header">
                              <span className="project-link-label">Project {i + 1}</span>
                              {data.project_links.length > 1 && (
                                <button type="button" className="project-link-remove" onClick={() => removeProjectLink(i)}>Remove</button>
                              )}
                            </div>
                            <input className="form-input" type="url" placeholder="https://github.com/... or https://project.com" value={link.url} onChange={(e) => updateProjectLink(i, 'url', e.target.value)} />
                            {errors[`project_link_${i}`] && <span className="form-error">{errors[`project_link_${i}`]}</span>}
                            <input className="form-input" type="text" placeholder="Brief description of what this is and your role in it" value={link.description} onChange={(e) => updateProjectLink(i, 'description', e.target.value)} />
                          </div>
                        ))}
                        {data.project_links.length < 3 && (
                          <button type="button" className="add-link-btn" onClick={addProjectLink}>+ Add another project</button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3 -- Your application */}
                  {step === 3 && (
                    <div style={{ paddingTop: '4px' }}>
                      <p className="form-section-desc">This is the most important part. We read every word.</p>
                      <div className="form-group">
                        <label className="form-label" htmlFor="cover_note">Why NexTrium</label>
                        <textarea className="form-input form-textarea" id="cover_note" placeholder="Tell us what draws you to NexTrium and why this role fits where you are going." value={data.cover_note} onChange={(e) => set('cover_note', e.target.value)} rows={5} />
                        {errors.cover_note && <span className="form-error">{errors.cover_note}</span>}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="currently_building">What you are currently learning or building</label>
                        <textarea className="form-input form-textarea" id="currently_building" placeholder="This can be a personal project, a course, a community you are part of, or anything that shows where your energy is going right now." value={data.currently_building} onChange={(e) => set('currently_building', e.target.value)} rows={4} />
                        {errors.currently_building && <span className="form-error">{errors.currently_building}</span>}
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="cv">CV or resume <span className="form-label-optional">optional</span></label>
                        <input className="form-input" id="cv" type="file" accept=".pdf,.doc,.docx" style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--grey-mid)' }} onChange={(e) => set('cv', e.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                  )}

                  {/* Step 4 -- Pledge */}
                  {step === 4 && (
                    <div style={{ paddingTop: '4px' }}>
                      <p className="form-section-desc">Before you submit, confirm each of the following individually. This is not a formality; it is the foundation of how we work together.</p>
                      {errors.pledge && <div className="form-error-box">{errors.pledge}</div>}
                      <div>
                        {PLEDGE_POINTS.map((point, i) => (
                          <label key={i} className="pledge-item" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={data.pledge[i]} onChange={() => togglePledge(i)} />
                            <span className={`pledge-item-text ${data.pledge[i] ? 'checked' : ''}`}>{point}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ height: '8px' }} />
                </div>

                <div className="app-modal-footer">
                  {step > 1 ? (
                    <button type="button" className="nav-btn" onClick={back}>← Back</button>
                  ) : (
                    <div />
                  )}
                  {step < totalSteps ? (
                    <button type="button" className="nav-btn nav-btn-primary" onClick={next}>Next →</button>
                  ) : (
                    <button
                      type="button"
                      className="nav-btn nav-btn-primary"
                      onClick={handleSubmit}
                      disabled={formState === 'submitting'}
                    >
                      {formState === 'submitting' ? 'Submitting...' : 'Submit application →'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}