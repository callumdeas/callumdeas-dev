export type OutputSegment = {
  text: string
  color?: string
  bold?: boolean
  italic?: boolean
  dim?: boolean
  link?: string
}

export type OutputLine = OutputSegment[]

export type HistoryEntry = {
  cwd: string
  command: string
  output: OutputLine[]
}

export type FileNode = {
  type: 'file'
  content: string
}

export type DirNode = {
  type: 'dir'
  children: Record<string, FSNode>
}

export type FSNode = FileNode | DirNode

export type CommandResult = {
  output: OutputLine[]
  newCwd?: string
  action?: { type: 'open'; url: string } | { type: 'clear' }
}
