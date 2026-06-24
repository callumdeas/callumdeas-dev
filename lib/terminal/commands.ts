import type { CommandResult, OutputLine, OutputSegment } from './types'
import {
  resolvePath,
  getNode,
  displayPath,
  listChildren,
  HOME,
} from './filesystem'

const C = {
  text: '#cdd6f4',
  dim: '#6c7086',
  green: '#a6e3a1',
  blue: '#89b4fa',
  cyan: '#89dceb',
  yellow: '#f9e2af',
  red: '#f38ba8',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#f5c2e7',
  overlay: '#9399b2',
}

function seg(text: string, color?: string, opts?: Partial<OutputSegment>): OutputSegment {
  return { text, color, ...opts }
}

function line(...segments: OutputSegment[]): OutputLine {
  return segments
}

function text(content: string): OutputLine[] {
  return content.split('\n').map((l) => (l ? [seg(l, C.text)] : [seg('')]))
}

function error(msg: string): CommandResult {
  return { output: [[seg(`error: ${msg}`, C.red)]] }
}

function renderMarkdown(content: string): OutputLine[] {
  return content.split('\n').map((rawLine) => {
    const segments: OutputSegment[] = []

    if (rawLine.startsWith('# ')) {
      segments.push(seg(rawLine.slice(2), C.mauve, { bold: true }))
    } else if (rawLine.startsWith('## ')) {
      segments.push(seg(rawLine.slice(3), C.blue, { bold: true }))
    } else if (rawLine.startsWith('### ')) {
      segments.push(seg(rawLine.slice(4), C.cyan, { bold: true }))
    } else if (rawLine.trim() === '') {
      segments.push(seg(''))
    } else {
      // Inline: handle → links and **bold**
      let remaining = rawLine
      let isFirst = true

      // Check for "key → value" pattern with URL
      const arrowMatch = remaining.match(/^(\s*)(.*?)\s+→\s+(.+)$/)
      if (arrowMatch) {
        const indent = arrowMatch[1]
        const label = arrowMatch[2]
        const value = arrowMatch[3].trim()

        if (indent) segments.push(seg(indent))
        if (label) segments.push(seg(label + ' ', C.overlay))
        segments.push(seg('→ ', C.dim))

        const urlPatterns = /^(https?:\/\/\S+|[\w.-]+\.\w{2,}\/\S*|[\w.-]+\.\w{2,})$/
        if (urlPatterns.test(value)) {
          const href = value.startsWith('http') ? value : 'https://' + value
          segments.push(seg(value, C.cyan, { link: href }))
        } else {
          segments.push(seg(value, C.text))
        }
        return segments
      }

      // Generic inline parsing for **bold** and `code`
      while (remaining.length > 0) {
        if (isFirst && remaining.match(/^\s{3,}/)) {
          const indentMatch = remaining.match(/^(\s+)/)
          if (indentMatch) {
            segments.push(seg(indentMatch[1]))
            remaining = remaining.slice(indentMatch[1].length)
            isFirst = false
            continue
          }
        }

        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
        if (boldMatch) {
          segments.push(seg(boldMatch[1], C.text, { bold: true }))
          remaining = remaining.slice(boldMatch[0].length)
          isFirst = false
          continue
        }

        const codeMatch = remaining.match(/^`(.+?)`/)
        if (codeMatch) {
          segments.push(seg(codeMatch[1], C.peach))
          remaining = remaining.slice(codeMatch[0].length)
          isFirst = false
          continue
        }

        // Eat one char
        segments.push(seg(remaining[0], C.text))
        remaining = remaining.slice(1)
        isFirst = false
      }
    }

    return segments.length > 0 ? segments : [seg('')]
  })
}

function cmdLs(cwd: string, args: string[]): CommandResult {
  const targetPath = args[0] ? resolvePath(cwd, args[0]) : cwd
  const node = getNode(targetPath)

  if (!node) return error(`ls: ${args[0] ?? '.'}: no such file or directory`)
  if (node.type === 'file') {
    return { output: [[seg(args[0] ?? '.', C.green)]] }
  }

  const names = listChildren(targetPath)
  if (names.length === 0) return { output: [[seg('')]] }

  const cols = 4
  const rows = Math.ceil(names.length / cols)
  const colWidth = 20
  const outputLines: OutputLine[] = []

  for (let r = 0; r < rows; r++) {
    const lineSegs: OutputSegment[] = []
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r
      if (idx >= names.length) break
      const name = names[idx]
      const childNode = (node.children as Record<string, (typeof node.children)[string]>)[name]
      const isDir = childNode?.type === 'dir'
      const display = isDir ? name + '/' : name
      const color = isDir ? C.blue : name.endsWith('.md') ? C.green : C.text
      const padded = display.padEnd(colWidth)
      lineSegs.push(seg(padded, color, { bold: isDir }))
    }
    outputLines.push(lineSegs)
  }

  return { output: outputLines }
}

function cmdCd(cwd: string, args: string[]): CommandResult {
  const target = args[0] ?? '~'
  const newPath = resolvePath(cwd, target)
  const node = getNode(newPath)

  if (!node) return error(`cd: ${target}: no such file or directory`)
  if (node.type !== 'dir') return error(`cd: ${target}: not a directory`)

  return { output: [], newCwd: newPath }
}

function cmdPwd(cwd: string): CommandResult {
  return { output: [[seg(cwd, C.text)]] }
}

function cmdCat(cwd: string, args: string[]): CommandResult {
  if (!args[0]) return error('cat: missing file operand')

  const targetPath = resolvePath(cwd, args[0])
  const node = getNode(targetPath)

  if (!node) return error(`cat: ${args[0]}: no such file or directory`)
  if (node.type === 'dir') return error(`cat: ${args[0]}: is a directory`)

  return { output: renderMarkdown(node.content) }
}

function cmdWhoami(): CommandResult {
  return {
    output: [
      [seg('callum', C.mauve, { bold: true })],
      [seg('')],
      [seg('Software Developer', C.text), seg(' · ', C.dim), seg('Scotland', C.text)],
      [seg('callum@elementsdevelopment.co.uk', C.cyan)],
      [seg('')],
      [seg('github.com/callumdeas', C.blue, { link: 'https://github.com/callumdeas' })],
    ],
  }
}

function cmdOpen(cwd: string, args: string[]): CommandResult {
  if (!args[0]) return error('open: missing argument')

  const arg = args[0]
  let url = ''

  if (arg.startsWith('http://') || arg.startsWith('https://')) {
    url = arg
  } else if (arg.includes('.') && !arg.startsWith('/') && !arg.startsWith('~') && !arg.startsWith('.')) {
    url = 'https://' + arg
  } else {
    const targetPath = resolvePath(cwd, arg)
    const node = getNode(targetPath)
    if (!node) return error(`open: ${arg}: no such file or directory`)
    if (node.type === 'file') return cmdCat(cwd, args)
    return cmdLs(cwd, args)
  }

  return {
    output: [[seg('Opening ', C.dim), seg(url, C.cyan), seg('…', C.dim)]],
    action: { type: 'open', url },
  }
}

function cmdEcho(args: string[]): CommandResult {
  return { output: [[seg(args.join(' '), C.text)]] }
}

function cmdHelp(): CommandResult {
  return {
    output: [
      [seg('Available commands', C.mauve, { bold: true })],
      [seg('')],
      [seg('  ls', C.green), seg(' [path]', C.dim), seg('         List directory contents')],
      [seg('  cd', C.green), seg(' [path]', C.dim), seg('         Change directory')],
      [seg('  pwd', C.green), seg('                  Print working directory')],
      [seg('  cat', C.green), seg(' <file>', C.dim), seg('        Display file contents')],
      [seg('  open', C.green), seg(' <url|path>', C.dim), seg('   Open URL or file')],
      [seg('  whoami', C.green), seg('               Display user information')],
      [seg('  echo', C.green), seg(' [text]', C.dim), seg('       Print text to terminal')],
      [seg('  clear', C.green), seg('                Clear the terminal')],
      [seg('  help', C.green), seg('                 Show this help message')],
      [seg('')],
      [seg('Keyboard shortcuts', C.mauve, { bold: true })],
      [seg('')],
      [seg('  ↑ / ↓', C.yellow), seg('               Navigate command history')],
      [seg('  Tab', C.yellow), seg('                  Autocomplete path')],
      [seg('  Ctrl+L', C.yellow), seg('               Clear screen')],
      [seg('  Ctrl+C', C.yellow), seg('               Cancel current input')],
      [seg('')],
      [seg('Try: ', C.dim), seg('ls', C.green), seg(' · ', C.dim), seg('cat about.md', C.green), seg(' · ', C.dim), seg('cd projects', C.green)],
    ],
  }
}

export function executeCommand(cwd: string, rawInput: string): CommandResult {
  const trimmed = rawInput.trim()
  if (!trimmed) return { output: [] }

  const tokens = parseTokens(trimmed)
  const [cmd, ...args] = tokens

  switch (cmd.toLowerCase()) {
    case 'ls':
      return cmdLs(cwd, args)
    case 'cd':
      return cmdCd(cwd, args)
    case 'pwd':
      return cmdPwd(cwd)
    case 'cat':
      return cmdCat(cwd, args)
    case 'whoami':
      return cmdWhoami()
    case 'open':
    case 'xdg-open':
      return cmdOpen(cwd, args)
    case 'echo':
      return cmdEcho(args)
    case 'clear':
      return { output: [], action: { type: 'clear' } }
    case 'help':
    case '--help':
    case '-h':
      return cmdHelp()
    case 'exit':
    case 'quit':
      return { output: [[seg('Nice try. You live here now.', C.dim)]] }
    case 'sudo':
      return { output: [[seg('Permission denied (obviously).', C.red)]] }
    case 'rm':
      return { output: [[seg("You can't delete my portfolio that easily.", C.yellow)]] }
    case 'git':
      return {
        output: [
          [seg('This repo is private. 😅', C.dim)],
          [seg('')],
          [seg('You can see what I build at:', C.dim)],
          [seg('  github.com/callumdeas', C.blue, { link: 'https://github.com/callumdeas' })],
        ],
      }
    case 'vim':
    case 'nvim':
    case 'nano':
    case 'emacs':
      return { output: [[seg('Nice editor taste. But read-only here.', C.dim)]] }
    case 'curl':
    case 'wget':
      return { output: [[seg('No network access in this terminal (it\'s pretend).', C.dim)]] }
    default:
      return {
        output: [
          [
            seg(`${cmd}: `, C.red),
            seg('command not found. ', C.text),
            seg('Type ', C.dim),
            seg('help', C.green),
            seg(' to see available commands.', C.dim),
          ],
        ],
      }
  }
}

function parseTokens(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

export { text, C }
