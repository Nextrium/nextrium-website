import { tint } from '@/lib/theme'

/** The round icon that heads each status and confirmation screen. */
export default function IconBadge({ token, size = 80, children }: { token: string; size?: number; children: React.ReactNode }) {
  return (
    <div
      className="rounded-full flex items-center justify-center mx-auto"
      style={{ width: size, height: size, background: tint(token, 10), border: `1px solid ${tint(token, 25)}` }}
    >
      {children}
    </div>
  )
}
