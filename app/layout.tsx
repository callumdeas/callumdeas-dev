import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, VT323 } from 'next/font/google'
import './globals.css'
import './_planet/world.css'

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

const pixel = VT323({ variable: '--font-pixel', subsets: ['latin'], weight: '400' })

const description =
  'Callum Deas is a software developer in Scotland building web apps, tools and interactive experiences, including Knotless, Macbelt, Name Game and Dish. Explore them on a tiny retro planet.'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.callumdeas.dev'),
  title: 'Callum Deas · Software developer',
  description,
  openGraph: {
    title: 'Callum Deas · Software developer',
    description,
    url: 'https://www.callumdeas.dev',
    siteName: 'callumdeas.dev',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'A tiny low-poly planet with a chapel, workshop, arcade and farmhouse' }],
  },
  twitter: { card: 'summary_large_image', title: 'Callum Deas · Software developer', description, images: ['/og.png'] },
}

export const viewport: Viewport = {
  themeColor: '#14233a',
  width: 'device-width',
  initialScale: 1,
}

const WORLD_SCRIPT = `try{var q=location.search;if(!/[?&]text(=|&|$)/.test(q)&&document.createElement('canvas').getContext('webgl2'))document.documentElement.dataset.world='on'}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${pixel.variable} h-full`} style={{ background: '#11111b' }} suppressHydrationWarning>
      <head>
        {/* Decide before first paint whether to show the planet or the text version. */}
        <script dangerouslySetInnerHTML={{ __html: WORLD_SCRIPT }} />
      </head>
      <body className="h-full antialiased" style={{ fontFamily: 'var(--font-mono), monospace', background: '#11111b' }}>
        {children}
      </body>
    </html>
  )
}
