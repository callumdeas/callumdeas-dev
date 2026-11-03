import type { LandmarkId } from './planet'

export type ProjectLink = { label: string; href: string }

export type Client = { name: string; href: string; blurb: string }

export type Project = {
  id: LandmarkId
  /** In-world place name. */
  place: string
  name: string
  kind: string
  tagline: string
  /** Shown with a typewriter effect, like PS1 dialogue. */
  intro: string
  highlights: readonly string[]
  stack: readonly string[]
  links: readonly ProjectLink[]
  status: string
  /** Client shopfronts (High Street only). */
  clients?: readonly Client[]
}

// Draft copy, pulled from each project's README. Links only where a public URL exists.
export const PROJECTS: readonly Project[] = [
  {
    id: 'chapel',
    place: 'The Chapel',
    name: 'Knotless',
    kind: 'SaaS product',
    tagline: 'Bookings, proposals and clients for wedding & event pros.',
    intro:
      'Knotless is the platform I am building for wedding and event professionals: one place to manage enquiries, bookings, proposals and clients, with an AI assistant that actually knows your business.',
    highlights: [
      'Drag-and-drop block editor for proposals and emails',
      'Client-facing proposals with analytics and status tracking',
      'Claude-powered assistant with database query tools',
      'Gmail API + Resend sending with automatic fallback',
      'Real-time updates across the app via Supabase',
    ],
    stack: ['Next.js', 'TypeScript', 'Supabase', 'PostgreSQL', 'Claude API', 'Resend'],
    links: [{ label: 'Visit knotless.co.uk', href: 'https://www.knotless.co.uk' }],
    status: 'In active development',
  },
  {
    id: 'workshop',
    place: 'The Workshop',
    name: 'Macbelt',
    kind: 'Native macOS app',
    tagline: 'Clipboard history, screenshots, annotation and recording in your menu bar.',
    intro:
      'Macbelt is my personal tool belt for the Mac. It replaced two paid apps I used every day: clipboard history, screenshots, annotation, OCR and screen recording, all native, with no servers and no telemetry.',
    highlights: [
      'Unlimited clipboard history with full-text search in SQLite',
      'Pinboards, paste stacks and quick-paste shortcuts',
      'All-in-one capture: select, annotate, OCR, pin or record',
      'Ignores password managers; your clipboard never leaves your Mac',
    ],
    stack: ['Swift', 'SwiftUI', 'AppKit', 'SQLite'],
    links: [{ label: 'Download latest release', href: 'https://github.com/callumdeas/macbelt-releases/releases/latest' }],
    status: 'Released',
  },
  {
    id: 'arcade',
    place: 'The Arcade',
    name: 'Name Game',
    kind: 'Multiplayer party game',
    tagline: 'Real-time party game for the web, iOS and Android.',
    intro:
      'Teams take turns describing names pulled from a shared bucket while their teammates race the clock. Play across phones in real time, or pass a single phone around the room.',
    highlights: [
      'Authoritative real-time game server',
      'Web and native clients sharing one pure game-logic package',
      'AI-generated name packs with content moderation',
      'Pass-and-play mode for one device',
    ],
    stack: ['Next.js', 'React Native', 'Expo', 'PartyKit', 'TypeScript', 'Turborepo'],
    links: [
      { label: 'Play on the web', href: 'https://namegame.callumdeas.dev' },
      { label: 'App Store', href: 'https://apps.apple.com/gb/app/the-name-game/id6757166888' },
    ],
    status: 'Live on web and iOS',
  },
  {
    id: 'farmhouse',
    place: 'The Farmhouse',
    name: 'Dish',
    kind: 'Mobile app',
    tagline: 'Recipes, meal plans and shopping lists, shared with your household.',
    intro:
      'Dish is where my recipes live. Import one from anywhere or write it up, plan the week, and get a shopping list sorted by aisle. Share a kitchen with the people you cook with, and it all works offline.',
    highlights: [
      'AI recipe parsing from links, text and photos',
      'Weekly meal planning with generated shopping lists',
      'Offline-first sync between household members',
      'Bundled grocery classifier to sort lists by aisle',
    ],
    stack: ['Expo', 'React Native', 'Fastify', 'PostgreSQL', 'Drizzle', 'PowerSync'],
    links: [
      { label: 'App Store', href: 'https://apps.apple.com/gb/app/dish-cook-shop/id6787367884' },
      { label: 'Website', href: 'https://recipes.callumdeas.dev' },
    ],
    status: 'Live on iOS',
  },
  {
    id: 'highstreet',
    place: 'High Street',
    name: 'Client work',
    kind: 'Freelance',
    tagline: 'Websites for bridal beauty businesses across Scotland and beyond.',
    intro:
      'Alongside my day job I build sites for small businesses. Each shop on this street is a real client, all from the bridal beauty world: polished, fast sites that win bookings.',
    highlights: [
      'Brand-led marketing sites built to turn visitors into enquiries',
      'A course and training platform with accounts and an API on Cloudflare Workers',
      'Image- and video-heavy portfolios that stay quick on mobile',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Hono', 'Cloudflare Workers', 'Framer Motion'],
    links: [],
    status: 'Live',
    clients: [
      {
        name: 'The Bridal Etiquette',
        href: 'https://www.thebridaletiquette.com/',
        blurb: 'Bridal makeup artistry education: courses and immersive training days.',
      },
      {
        name: 'Brooke Lilias Makeup',
        href: 'https://brookeliliasmakeup.com/',
        blurb: 'Luxury bridal and destination makeup artist based in Edinburgh.',
      },
      {
        name: 'Brooklyn Bridal Artists',
        href: 'https://www.brooklynbridalartists.com/',
        blurb: 'A Scotland-based collective of bridal makeup artists and hairstylists.',
      },
    ],
  },
  {
    id: 'stadium',
    place: 'The Stadium',
    name: 'FanDuel',
    kind: 'Day job · since 2021',
    tagline: 'Front-end and mobile engineer on Sportsbook.',
    intro:
      "My day job. Since 2021 I've been a front-end and mobile engineer at FanDuel, working on the Sportsbook product across the web and native apps with React, React Native and TypeScript.",
    highlights: [
      'Sportsbook features for web and the iOS and Android apps',
      'React and React Native, written in TypeScript',
      'Working on a large, fast-moving consumer product at scale',
    ],
    stack: ['React', 'React Native', 'TypeScript'],
    links: [],
    status: 'Current role',
  },
]

export const ABOUT = {
  name: 'Callum Deas',
  role: 'Front-end & mobile engineer at FanDuel · Scotland',
  intro:
    "Hi, I'm Callum! I build web apps, tools and interactive things like this little planet. Click a building to see what I've been making, or say hello.",
  summary:
    "I'm a front-end and mobile engineer at FanDuel, working on Sportsbook with React, React Native and TypeScript. Outside of that I build my own products and sites for clients in the bridal beauty world, with a focus on clean interfaces, real-time systems and AI integrations.",
  links: [
    { label: 'Email', href: 'mailto:callumdeas@gmail.com' },
    { label: 'GitHub', href: 'https://github.com/callumdeas' },
    { label: 'LinkedIn', href: 'https://uk.linkedin.com/in/callum-deas-a2a861105' },
  ],
}

export function projectById(id: LandmarkId): Project {
  const p = PROJECTS.find((x) => x.id === id)
  if (!p) throw new Error(`No project for ${id}`)
  return p
}
