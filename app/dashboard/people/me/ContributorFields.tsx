'use client'

import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/contributions/constants'

export interface ContributorFieldsValue {
  displayName: string
  categories: Category[]
  skillsText: string
  availability: string
  notifyEmail: boolean
}

/** Contributor preferences section of the profile form. Optional for staff, required for members. */
export default function ContributorFields({
  value,
  onChange,
  optional = false,
}: {
  value: ContributorFieldsValue
  onChange: (next: ContributorFieldsValue) => void
  optional?: boolean
}) {
  const toggle = (c: Category) =>
    onChange({ ...value, categories: value.categories.includes(c) ? value.categories.filter((x) => x !== c) : [...value.categories, c] })

  return (
    <>
      <div className="profile-form-section-title">Contributing{optional ? ' (optional)' : ''}</div>
      {optional && <p className="profile-discord-name" style={{ margin: '-6px 0 14px' }}>Fill this in if you want to take on contributor tasks.</p>}
      <label className="profile-form-label" htmlFor="contrib-name">Display name (shown on the leaderboard)</label>
      <input id="contrib-name" className="profile-form-input" type="text" maxLength={60} placeholder="How other contributors see you"
        value={value.displayName} onChange={(e) => onChange({ ...value, displayName: e.target.value })} />

      <label className="profile-form-label">Areas you want tasks in</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
        {CATEGORIES.map((c) => (
          <label key={c} className="profile-discord-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input type="checkbox" name="contrib-category" value={c} checked={value.categories.includes(c)} onChange={() => toggle(c)} />
            {CATEGORY_LABELS[c]}
          </label>
        ))}
      </div>

      <label className="profile-form-label" htmlFor="contrib-skills">Skills (comma separated)</label>
      <input id="contrib-skills" className="profile-form-input" type="text" placeholder="React, Figma, community events"
        value={value.skillsText} onChange={(e) => onChange({ ...value, skillsText: e.target.value })} />

      <label className="profile-form-label" htmlFor="contrib-availability">Hours per week you can give (optional)</label>
      <input id="contrib-availability" className="profile-form-input" type="number" min={0} max={168} step={1}
        value={value.availability} onChange={(e) => onChange({ ...value, availability: e.target.value })} />

      <label className="profile-discord-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', cursor: 'pointer' }}>
        <input type="checkbox" id="contrib-notify" checked={value.notifyEmail} onChange={(e) => onChange({ ...value, notifyEmail: e.target.checked })} />
        Email me about my tasks and reviews
      </label>
    </>
  )
}
