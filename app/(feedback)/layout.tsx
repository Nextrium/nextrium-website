import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Evaluation Report',
  robots: { index: false, follow: false },
}

// Nested under app/layout.tsx, which already renders <html>/<body> with the
// same fonts and globals.css. Rendering a second <html>/<body> here nested
// them inside the root <body> (invalid HTML) and caused a hydration mismatch
// on every /feedback page.
export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
