'use client'

import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import { submitRebuttal } from './actions'
import styles from './ReportRebuttalClient.module.css'

export default function ReportRebuttalClient({
  reportId,
  dimensions,
}: {
  reportId:   string
  dimensions: string[]
}) {
  const router = useRouter()

  const [selected,   setSelected]   = useState<string[]>([])
  const [statement,  setStatement]  = useState('')
  const [urls,       setUrls]       = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState(false)

  function toggleDimension(dim: string) {
    setSelected((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim]
    )
  }

  function addUrl() {
    if (urls.length < 5) setUrls((prev) => [...prev, ''])
  }

  function updateUrl(i: number, val: string) {
    setUrls((prev) => prev.map((u, idx) => idx === i ? val : u))
  }

  function removeUrl(i: number) {
    setUrls((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const validUrls = urls.filter((u) => u.trim())
    const result    = await submitRebuttal(
      reportId, selected, statement, validUrls
    )

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push(`/feedback/${reportId}`), 3000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.brand}>Nextrium Global Innovations Ltd</div>
      <a href={`/feedback/${reportId}`} className={styles.back}>
        Back to report
      </a>

      {success ? (
        <div className={styles.success}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>Rebuttal submitted</div>
          <p className={styles.successDesc}>
            Your rebuttal has been received and will be reviewed by the
            Nextrium operations team. Returning you to your report.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.title}>Submit a rebuttal</div>
          <p className={styles.subtitle}>
            If a specific finding in your evaluation report is factually
            incorrect based on what you submitted in your original
            application, you can dispute it here. One rebuttal is
            permitted per report.
          </p>

          <div className={styles.notice}>
            Only evidence that was part of your original application can be
            referenced. Work completed after your application date will not
            be considered. Submitting a rebuttal does not guarantee a change
            in outcome. All rebuttals are reviewed by the Nextrium
            operations team.
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formSection}>
              <label className={styles.label}>
                Which findings are you disputing?
              </label>
              {dimensions.map((dim) => (
                <label key={dim} className={styles.dimRow}>
                  <input
                    type="checkbox"
                    checked={selected.includes(dim)}
                    onChange={() => toggleDimension(dim)}
                  />
                  <span>{dim}</span>
                </label>
              ))}
            </div>

            <div className={styles.formSection}>
              <label className={styles.label} htmlFor="statement">
                Your evidence statement
                <span className={styles.labelNote}>max 2000 characters</span>
              </label>
              <textarea
                id="statement"
                className={styles.textarea}
                placeholder="Explain specifically what the report got wrong and why, referencing only what was in your original application."
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                maxLength={2000}
              />
              <div className={styles.char}>{statement.length} / 2000</div>
            </div>

            <div className={styles.formSection}>
              <label className={styles.label}>
                Supporting links from your original application
                <span className={styles.labelNote}>optional, max 5</span>
              </label>
              {urls.map((url, i) => (
                <div key={i} className={styles.urlRow}>
                  <input
                    className={styles.urlInput}
                    type="url"
                    placeholder="https://github.com/..."
                    value={url}
                    onChange={(e) => updateUrl(i, e.target.value)}
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      className={styles.urlRemove}
                      onClick={() => removeUrl(i)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {urls.length < 5 && (
                <button
                  type="button"
                  className={styles.addUrl}
                  onClick={addUrl}
                >
                  + Add link
                </button>
              )}
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.submit}
              disabled={
                submitting ||
                selected.length === 0 ||
                !statement.trim()
              }
            >
              {submitting ? 'Submitting...' : 'Submit rebuttal'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
