'use client'

import { useEffect, useState } from 'react'
import { submitReportRating } from './actions'
import styles from './ReportClient.module.css'

export default function RatingWidget({ reportId }: { reportId: string }) {
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [stars,        setStars]        = useState(0)
  const [hoverStars,   setHoverStars]   = useState(0)
  const [rationale,    setRationale]    = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    try {
      if (localStorage.getItem(`nextrium-report-rated-${reportId}`)) {
        setAlreadyRated(true)
      }
    } catch {
      // localStorage unavailable — allow rating regardless
    }
  }, [reportId])

  function openModal(initialStars: number) {
    setStars(initialStars)
    setError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setStars(0)
    setRationale('')
    setError('')
  }

  async function handleSubmit() {
    if (stars < 1) {
      setError('Please select a star rating.')
      return
    }
    if (!rationale.trim()) {
      setError('Please tell us why you gave this rating.')
      return
    }

    setSubmitting(true)
    setError('')

    const result = await submitReportRating(reportId, stars, rationale.trim())

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setModalOpen(false)
    setAlreadyRated(true)
    try {
      localStorage.setItem(`nextrium-report-rated-${reportId}`, String(stars))
    } catch {
      // ignore
    }
  }

  if (alreadyRated) {
    return <span className={styles.ratedNote}>✓ Thanks for rating this report</span>
  }

  return (
    <>
      <button
        type="button"
        className={styles.rateBtn}
        onClick={() => openModal(0)}
      >
        Rate this report
        <span className={styles.rateBtnStars}>☆☆☆☆☆</span>
      </button>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalTitle}>Rate this evaluation report</div>
            <p className={styles.modalSubtitle}>
              How fair and accurate did you find this report? Your rationale
              helps Nextrium improve the quality of AI-assisted feedback.
            </p>

            <div className={styles.modalStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.modalStar} ${n <= (hoverStars || stars) ? styles.filled : ''}`}
                  onMouseEnter={() => setHoverStars(n)}
                  onMouseLeave={() => setHoverStars(0)}
                  onClick={() => setStars(n)}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  {n <= (hoverStars || stars) ? '★' : '☆'}
                </button>
              ))}
            </div>

            <label className={styles.modalLabel} htmlFor="rating-rationale">
              Why did you give this rating?
            </label>
            <textarea
              id="rating-rationale"
              className={styles.modalTextarea}
              placeholder="Tell us what the report got right or wrong…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              maxLength={1000}
            />

            {error && <div className={styles.modalError}>{error}</div>}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={closeModal}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmit}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
