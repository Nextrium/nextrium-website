import type { Metadata } from 'next'
import { Exo_2, DM_Sans, Space_Mono } from 'next/font/google'
import { brand, brandCssVariables } from '@nextrium/brand'
import './globals.css'

const exo2 = Exo_2({ subsets: ['latin'], weight: ['300', '400', '600', '700', '800', '900'], variable: '--font-exo2', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-dm', display: 'swap' })
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(brand.urls.contribute),
  title: { default: `Contribute | ${brand.styledName}`, template: `%s | ${brand.styledName} Contribute` },
  description: `Contribute to ${brand.name}: claim open tasks, ship work, earn points and build a public record of what you have done.`,
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    siteName: `${brand.styledName} Contribute`,
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Brand colour tokens; every component reads them as var(--token). */}
        <style dangerouslySetInnerHTML={{ __html: brandCssVariables() }} />
      </head>
      <body className={`${exo2.variable} ${dmSans.variable} ${spaceMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
