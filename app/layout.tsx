import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Callum Deas',
  description: 'Software developer based in Scotland. Personal terminal — explore my projects and experience.',
  openGraph: {
    title: 'Callum Deas',
    description: 'Software developer based in Scotland.',
    url: 'https://callumdeas.dev',
    siteName: 'callumdeas.dev',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full`} style={{ background: '#11111b' }}>
      <body className="h-full antialiased" style={{ fontFamily: 'var(--font-mono), monospace', background: '#11111b' }}>
        {children}
      </body>
    </html>
  )
}
