'use client'

import Link from 'next/link'
import RatingWidget from './RatingWidget'
import styles from './ReportClient.module.css'

interface DimensionFeedback {
  dimension: string
  score:     number
  maxScore:  number
  finding:   string
}

interface DimensionScores {
  generalStatement:  string
  dimensionFeedback: DimensionFeedback[]
  strengths:         string[]
  gaps:              string[]
}

interface Report {
  id:                 string
  composite_score:    number
  evaluation_track:   string
  recommendation:     string
  consensus_tier:     string
  feedback_body:      string
  rebuttal_submitted: boolean
  rebuttal_locked:    boolean
  created_at:         string
  dimension_scores:   DimensionScores
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  'Strong Hire':                 '22C17A',
  'Proceed to Recruiter Screen': '4A6FA5',
  'Hold':                        'D4A843',
  'Reject':                      'E84545',
}

export default function ReportClient({ report, rebuttalStatus }: { report: Report; rebuttalStatus: string | null }) {
  const ds      = report.dimension_scores
  const recColor = RECOMMENDATION_COLORS[report.recommendation] ?? '8A9BB0'

  const date = new Date(report.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className={styles.page}>
      <div className={styles.brand}>Nextrium Global Innovations Ltd</div>

      <div className={styles.reportId}>Report ID: {report.id}</div>
      <div className={styles.title}>Your evaluation report</div>
      <div className={styles.date}>Evaluated on {date}</div>

      <div className={styles.scoreBlock}>
        <div className={styles.scoreNumber}>{report.composite_score}</div>
        <div className={styles.scoreMeta}>
          <div className={styles.scoreLabel}>Composite match score out of 100</div>
          <div className={styles.tier}>{report.consensus_tier}</div>
          <div
            className={styles.recBadge}
            style={{
              background: `#${recColor}18`,
              color:      `#${recColor}`,
            }}
          >
            {report.recommendation}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>About this evaluation</div>
        <div className={styles.general}>{ds.generalStatement}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Overall finding</div>
        <div className={styles.overall}>{report.feedback_body}</div>
      </div>

      {ds.dimensionFeedback?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Dimension breakdown</div>
          {ds.dimensionFeedback.map((d, i) => (
            <div key={i} className={styles.dimension}>
              <div className={styles.dimHeader}>
                <div className={styles.dimName}>{d.dimension}</div>
                <div className={styles.dimScore}>{d.score} / {d.maxScore}</div>
              </div>
              <div className={styles.dimBarBg}>
                <div
                  className={styles.dimBarFill}
                  style={{
                    width: `${Math.round((d.score / d.maxScore) * 100)}%`,
                  }}
                />
              </div>
              <div className={styles.dimFinding}>{d.finding}</div>
            </div>
          ))}
        </div>
      )}

      {ds.strengths?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Verified strengths</div>
          {ds.strengths.map((s, i) => (
            <div key={i} className={styles.listItem}>{s}</div>
          ))}
        </div>
      )}

      {ds.gaps?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Areas not verified or gaps identified</div>
          {ds.gaps.map((g, i) => (
            <div key={i} className={`${styles.listItem} ${styles.gapItem}`}>{g}</div>
          ))}
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.rebuttalBlock}>
        <div className={styles.rebuttalTitle}>
          Is something in this report factually incorrect?
        </div>
        {report.rebuttal_submitted ? (
          <div className={styles.rebuttalDone}>
            {rebuttalStatus === 'resolved'
              ? 'Your dispute has been reviewed and accepted — this report has been updated to reflect the revised assessment.'
              : rebuttalStatus === 'dismissed'
              ? 'Your dispute has been reviewed. After careful consideration, the original assessment has been upheld.'
              : 'Your rebuttal has been submitted and is under review by the Nextrium operations team.'}
          </div>
        ) : (
          <p className={styles.rebuttalDesc}>
            If a specific finding in this report is factually incorrect
            based on what you submitted in your original application, you
            can dispute it here. One rebuttal is permitted per report.
            Only evidence that was part of your original submission can
            be referenced.
          </p>
        )}
        <div className={styles.actionsRow}>
          {!report.rebuttal_submitted && (
            <Link
              href={`/feedback/${report.id}/rebuttal`}
              className={styles.rebuttalBtn}
            >
              Submit a rebuttal
            </Link>
          )}
          <RatingWidget reportId={report.id} />
        </div>
      </div>
    </div>
  )
}
