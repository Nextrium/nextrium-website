'use client'

import Link from 'next/link'
import type { NTEvent } from '@nextrium/supabase/database'
import { useDashboardSearch } from '@/lib/dashboard/useDashboardSearch'
import DashboardSearchBox from '@/components/dashboard/DashboardSearchBox'

const TYPE_LABELS: Record<NTEvent['event_type'], string> = {
  hackathon: 'Hackathon',
  workshop:  'Workshop',
  summit:    'Summit',
  community: 'Community',
  other:     'Other',
}

const STATUS_STYLES: Record<NTEvent['status'], { bg: string; color: string }> = {
  upcoming:  { bg: 'rgba(74,111,165,0.1)',  color: 'var(--slate)'   },
  ongoing:   { bg: 'rgba(212,168,67,0.1)',  color: 'var(--gold)'    },
  completed: { bg: 'rgba(34,193,122,0.1)',  color: 'var(--success)' },
  cancelled: { bg: 'rgba(232,69,69,0.1)',   color: 'var(--error)'   },
}

export default function EventsListClient({ events }: { events: NTEvent[] }) {
  const { query, setQuery, results } = useDashboardSearch(
    events,
    (event) => [event.title, event.location, TYPE_LABELS[event.event_type]]
  )

  return (
    <>
      <div className="dash-list-header">
        <span className="dash-list-count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <DashboardSearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search events by title, location, or type..."
          resultCount={results.length}
        />
      </div>

      {results.length === 0 ? (
        <div className="dash-empty-state">
          <div className="dash-empty-title">No events match your search.</div>
        </div>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
                <th>Location</th>
                <th>Hub</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((event) => {
                const ss = STATUS_STYLES[event.status]
                return (
                  <tr key={event.slug}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--white)' }}>{event.title}</div>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{TYPE_LABELS[event.event_type]}</td>
                    <td>
                      <span className="dash-badge" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}33` }}>
                        {event.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                      {new Date(event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>{event.location}</td>
                    <td>
                      {event.is_hub_event && <span className="dash-badge badge-hub">Hub</span>}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                      {new Date(event.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <Link href={`/dashboard/events/${event.slug}`} className="dash-edit-link">Edit →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
