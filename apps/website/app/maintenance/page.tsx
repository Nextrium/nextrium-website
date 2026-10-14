'use client'

import { useEffect, useState } from 'react'

const DEADLINE = new Date('2026-06-08T23:59:00Z')

function useCountdown(target: Date) {
  const [time, setTime] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0,
  })

  useEffect(() => {
    function tick() {
      const now = new Date()
      const diff = target.getTime() - now.getTime()
      if (diff <= 0) {
        setTime({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return time
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function NTMark({ size = 52 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect x="4" y="4" width="16" height="72" rx="4" fill="#F5F6F8" />
      <polygon points="20,4 36,4 76,68 76,76 60,76 20,12" fill="#F5F6F8" />
      <rect x="60" y="4" width="16" height="72" rx="4" fill="#F5F6F8" />
      <rect x="4" y="4" width="72" height="18" rx="4" fill="#DB6727" />
      <rect x="32" y="4" width="16" height="36" rx="3" fill="#DB6727" />
    </svg>
  )
}

function CountUnit({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: 'clamp(60px, 12vw, 100px)',
        height: 'clamp(60px, 12vw, 100px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0D233D',
        border: '1px solid #163352',
        borderRadius: 'clamp(8px, 1.5vw, 14px)',
        fontFamily: "'Exo 2', sans-serif",
        fontWeight: 900,
        fontSize: 'clamp(24px, 5vw, 44px)',
        color: '#FFFFFF',
        letterSpacing: '-1px',
      }}>
        {pad(value)}
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 'clamp(7px, 1vw, 10px)',
        letterSpacing: '0.2em',
        color: '#8A9BB0',
        textTransform: 'uppercase' as const,
      }}>
        {label}
      </div>
    </div>
  )
}

function Colon() {
  return (
    <div style={{
      fontFamily: "'Exo 2', sans-serif",
      fontWeight: 900,
      fontSize: 'clamp(24px, 5vw, 44px)',
      color: '#DB6727',
      paddingBottom: 'clamp(16px, 3vw, 26px)',
      alignSelf: 'flex-end',
      lineHeight: 1,
    }}>:</div>
  )
}

export default function MaintenancePage() {
  const { days, hours, minutes, seconds } = useCountdown(DEADLINE)

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page {
          min-height: 100vh;
          background: #071628;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(32px, 6vw, 80px) clamp(20px, 6vw, 80px);
          position: relative;
          overflow: hidden;
          text-align: center;
        }
        .glow {
          position: fixed; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse at 75% 15%, rgba(219,103,39,0.09) 0%, transparent 55%),
            radial-gradient(ellipse at 20% 85%, rgba(10,139,139,0.06) 0%, transparent 50%);
        }
        .logo { display: flex; align-items: center; gap: clamp(12px, 2vw, 20px); margin-bottom: clamp(40px, 7vw, 72px); position: relative; z-index: 1; }
        .wordmark-text { display: flex; flex-direction: column; gap: 5px; text-align: left; }
        .wordmark { font-family: var(--font-exo2), 'Exo 2', sans-serif; font-weight: 900; font-size: clamp(28px, 5vw, 48px); letter-spacing: -0.5px; line-height: 1; }
        .tagline { font-family: var(--font-mono), 'Space Mono', monospace; font-size: clamp(7px, 1vw, 10px); letter-spacing: 0.16em; color: #8A9BB0; text-transform: uppercase; white-space: nowrap; }
        .status-tag { font-family: var(--font-mono), 'Space Mono', monospace; font-size: clamp(8px, 1.2vw, 11px); letter-spacing: 0.25em; color: #DB6727; text-transform: uppercase; margin-bottom: clamp(12px, 2vw, 20px); position: relative; z-index: 1; }
        .headline { font-family: var(--font-exo2), 'Exo 2', sans-serif; font-weight: 800; font-size: clamp(32px, 7vw, 80px); letter-spacing: -2px; line-height: 1.05; color: #FFFFFF; margin-bottom: clamp(16px, 3vw, 28px); position: relative; z-index: 1; max-width: 900px; }
        .description { font-family: var(--font-dm), 'DM Sans', sans-serif; font-size: clamp(14px, 1.8vw, 18px); color: #8A9BB0; max-width: 520px; line-height: 1.75; margin-bottom: clamp(40px, 7vw, 72px); position: relative; z-index: 1; }
        .countdown { display: flex; align-items: flex-end; gap: clamp(6px, 1.5vw, 16px); margin-bottom: clamp(40px, 7vw, 72px); position: relative; z-index: 1; flex-wrap: nowrap; }
        .divider { width: clamp(40px, 8vw, 80px); height: 1px; background: #163352; margin: 0 auto clamp(16px, 3vw, 28px); position: relative; z-index: 1; }
        .footer-text { font-family: var(--font-mono), 'Space Mono', monospace; font-size: clamp(8px, 1vw, 10px); letter-spacing: 0.2em; color: #4A6FA5; text-transform: uppercase; position: relative; z-index: 1; }
      `}</style>

      <main className="page">
        <div className="glow" />

        <div className="logo">
          <NTMark size={52} />
          <div className="wordmark-text">
            <div className="wordmark">
              <span style={{ color: '#F5F6F8' }}>Nex</span>
              <span style={{ color: '#DB6727' }}>T</span>
              <span style={{ color: '#F5F6F8' }}>rium</span>
            </div>
            <div className="tagline">Innovation. Incubation. Impact.</div>
          </div>
        </div>

        <div className="status-tag">Website Refresh in Progress</div>

        <h1 className="headline">
          We&apos;re upgrading<br />
          <span style={{ color: '#DB6727' }}>our experience.</span>
        </h1>

        <p className="description">
          NexTrium is undergoing a full refresh. We&apos;re rebuilding
          our digital presence to better reflect who we are and what
          we deliver. Check back shortly.
        </p>

        <div className="countdown">
          <CountUnit label="Days" value={days} />
          <Colon />
          <CountUnit label="Hours" value={hours} />
          <Colon />
          <CountUnit label="Minutes" value={minutes} />
          <Colon />
          <CountUnit label="Seconds" value={seconds} />
        </div>

        <div className="divider" />

        <div className="footer-text">
          RC: 9506507 &nbsp;·&nbsp; Lagos, Nigeria &nbsp;·&nbsp; Est. 2026
        </div>
      </main>
    </>
  )
}
