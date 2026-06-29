import type { FSNode } from './types'

export const HOME = '/home/callum'

export const ROOT: FSNode = {
  type: 'dir',
  children: {
    home: {
      type: 'dir',
      children: {
        callum: {
          type: 'dir',
          children: {
            'about.md': {
              type: 'file',
              content: `# Callum Deas

Software developer based in Scotland. I build web applications, tools,
and interactive experiences — with a focus on clean interfaces, real-time
systems, and AI integrations.

## What I Do

I run Elements Development, building digital products for clients across
hospitality, health and beauty, and events industries. I also ship personal
projects in my spare time (this terminal being one of them).

## Currently Interested In

- Real-time multiplayer applications
- AI-powered developer tools
- Minimal, performant web experiences
- TypeScript everywhere

## Background

Self-taught developer with a few years of professional experience building
and shipping production applications. I enjoy working across the full stack
but I lean frontend-first.
`,
            },
            'experience.md': {
              type: 'file',
              content: `# Experience

## Elements Development                              2022 – Present
   Founder / Lead Developer

   Building web applications and digital products for clients.
   Specialising in React, Next.js, and TypeScript. Projects range
   from bridal booking platforms to AI-powered tools.

   Tech: Next.js · TypeScript · Tailwind CSS · Supabase · Railway

## Skills

   Frontend    React, Next.js, TypeScript, Tailwind CSS, Radix UI
   Backend     Node.js, Express, PostgreSQL, Supabase, Prisma
   Real-time   WebSockets, PartyKit, Server-Sent Events
   AI          Vercel AI SDK, OpenAI, Claude API
   Infra       Railway, Vercel, Docker, GitHub Actions
   Tools       Git, pnpm, Turborepo, Playwright

## Education

   Self-taught. Built production apps. Shipped and learned.
`,
            },
            'contact.md': {
              type: 'file',
              content: `# Contact

   Email     →  callum@elementsdevelopment.co.uk
   GitHub    →  github.com/callumdeas
   LinkedIn  →  linkedin.com/in/callumdeas

   Open to interesting projects and collaborations.
   Don't be shy — say hello.
`,
            },
            projects: {
              type: 'dir',
              children: {
                'name-game': {
                  type: 'dir',
                  children: {
                    'README.md': {
                      type: 'file',
                      content: `# Name Game
   Real-time multiplayer party game

## About

   Name Game is a digital version of the classic parlour game where each
   player writes 15 names and puts them in a virtual "bucket". Teams then
   take 60-second rounds describing names to their teammates without saying
   the name itself.

   No accounts required. Jump in with a game code.

## Features

   - Create or join games with a short shareable code
   - Configurable settings: names per player, round duration
   - AI-powered name suggestions (so no one goes blank)
   - Real-time sync across all connected devices
   - Works on mobile and desktop

## Tech Stack

   Framework    Next.js 16 + React 19
   Real-time    PartyKit (WebSockets)
   AI           Vercel AI SDK
   Mobile       Expo (React Native)
   Infra        Railway

## Play

   → namegame.callumdeas.dev

   Private repository.
`,
                    },
                  },
                },
                recipes: {
                  type: 'dir',
                  children: {
                    'README.md': {
                      type: 'file',
                      content: `# Recipes
   AI-powered meal planning

## About

   A personal meal planning tool that generates comprehensive weekly
   meal plans based on the kinds of food you're feeling inspired by.
   Tell it your vibes, get a full plan with a consolidated shopping list.

## Features

   - Log meal inspirations by category (breakfast, lunch, dinner, snack)
   - AI generates a full weekly meal plan from your inspirations
   - Auto-consolidated shopping lists with quantities
   - Save and compare multiple meal plans
   - In-app AI chat for meal planning advice
   - Recipe saving from generated plans

## Tech Stack

   Framework     Next.js 15 + TypeScript
   AI            OpenAI via Vercel AI SDK
   Database      Supabase (PostgreSQL)
   Auth          Clerk
   UI            Tailwind CSS + shadcn/ui
   Infra         Railway

## Visit

   → recipes.callumdeas.dev

   Private repository.
`,
                    },
                  },
                },
                wt: {
                  type: 'dir',
                  children: {
                    'README.md': {
                      type: 'file',
                      content: `# wt
   Git worktree manager

## About

   wt (short for doubleut) is a CLI tool for managing git worktrees.
   Worktrees let you check out multiple branches simultaneously in
   separate directories — wt makes creating, switching, and cleaning
   them up fast and ergonomic.

## Features

   - Create and switch worktrees with a single command
   - List all active worktrees with branch and path info
   - Remove worktrees safely with branch cleanup
   - Fuzzy-pick worktrees interactively

## Tech Stack

   Runtime       Node.js + TypeScript
   CLI           Commander.js
   Interactivity Inquirer

## Source

   → github.com/callumdeas/wt

   Open source.
`,
                    },
                  },
                },
                knotless: {
                  type: 'dir',
                  children: {
                    'README.md': {
                      type: 'file',
                      content: `# Knotless
   Bridal CRM platform

## About

   Knotless is a CRM built specifically for bridal boutiques and wedding
   dress retailers. It centralises client records, appointment scheduling,
   order tracking, and follow-ups — replacing scattered spreadsheets and
   generic tools with something purpose-built for the industry.

## Features

   - Client profiles with measurements, notes, and order history
   - Appointment scheduling with automated reminders
   - Order and alterations tracking through to collection
   - Follow-up workflows and communication logs
   - Dashboard overview of upcoming appointments and orders

## Tech Stack

   Framework     Next.js + TypeScript
   Database      Supabase (PostgreSQL)
   Auth          Supabase Auth
   UI            Tailwind CSS + shadcn/ui
   Infra         Railway

## Visit

   → knotless.co.uk

   Private repository.
`,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export function resolvePath(cwd: string, inputPath: string): string {
  if (!inputPath || inputPath === '') return cwd
  if (inputPath === '~') return HOME
  if (inputPath.startsWith('~/')) return HOME + inputPath.slice(1)
  if (inputPath.startsWith('/')) return normalizePath(inputPath)
  return normalizePath(cwd + '/' + inputPath)
}

function normalizePath(path: string): string {
  const parts = path.split('/').filter((p) => p !== '')
  const result: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      result.pop()
    } else {
      result.push(part)
    }
  }
  return '/' + result.join('/')
}

export function getNode(path: string): FSNode | null {
  if (path === '/') return ROOT
  const parts = path.split('/').filter((p) => p !== '')
  let current: FSNode = ROOT
  for (const part of parts) {
    if (current.type !== 'dir') return null
    const child = current.children[part]
    if (!child) return null
    current = child
  }
  return current
}

export function displayPath(path: string): string {
  if (path === HOME) return '~'
  if (path.startsWith(HOME + '/')) return '~' + path.slice(HOME.length)
  return path
}

export function listChildren(path: string): string[] {
  const node = getNode(path)
  if (!node || node.type !== 'dir') return []
  return Object.keys(node.children).sort((a, b) => {
    const aIsDir = node.children[a].type === 'dir'
    const bIsDir = node.children[b].type === 'dir'
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return a.localeCompare(b)
  })
}

export function getCompletions(cwd: string, partial: string): string[] {
  const lastSlash = partial.lastIndexOf('/')
  const dir = lastSlash >= 0 ? partial.slice(0, lastSlash + 1) : ''
  const prefix = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial

  const searchDir = dir ? resolvePath(cwd, dir.endsWith('/') ? dir.slice(0, -1) : dir) : cwd
  const node = getNode(searchDir)
  if (!node || node.type !== 'dir') return []

  return Object.keys(node.children)
    .filter((name) => name.startsWith(prefix))
    .map((name) => {
      const isDir = node.children[name].type === 'dir'
      return dir + name + (isDir ? '/' : '')
    })
}
