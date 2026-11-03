/**
 * The post office's letter: shape, limits and validation, shared by the form
 * (for friendly errors) and the /api/enquiry route (which never trusts the client).
 */

/** Where letters go: the public address already listed on the site. */
export const ENQUIRY_TO = 'callumdeas@gmail.com'

export const TOPICS = [
  { id: 'website', label: 'A website for my business' },
  { id: 'product', label: 'App or product work' },
  { id: 'job', label: 'A role or opportunity' },
  { id: 'hello', label: 'Just saying hello' },
] as const

export type TopicId = (typeof TOPICS)[number]['id']

export const isTopicId = (v: unknown): v is TopicId => typeof v === 'string' && TOPICS.some((t) => t.id === v)

export const topicLabel = (id: TopicId) => TOPICS.find((t) => t.id === id)?.label ?? id

export const LIMITS = { name: 100, email: 200, message: 4000, minMessage: 10 } as const

/** Letters written faster than this are almost certainly bots. */
export const MIN_FILL_MS = 3000

export type Letter = {
  name: string
  email: string
  topic: TopicId
  message: string
}

export type LetterPayload = Letter & {
  /** Honeypot: hidden from people, irresistible to bots. Must be empty. */
  website: string
  /** How long the form was open before sending. */
  elapsedMs: number
}

export type EnquiryResult = { status: 'sent' } | { status: 'unconfigured' } | { status: 'invalid'; error: string } | { status: 'failed' }

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

export type FieldErrors = Partial<Record<keyof Letter, string>>

/** Friendly per-field problems, or an empty object when the letter is fine. */
export function checkLetter(l: Letter): FieldErrors {
  const errors: FieldErrors = {}
  if (!l.name.trim()) errors.name = 'Who should Callum reply to?'
  else if (l.name.length > LIMITS.name) errors.name = 'That name is a bit long.'
  if (!EMAIL.test(l.email.trim()) || l.email.length > LIMITS.email) errors.email = 'That email address doesn’t look right.'
  if (l.message.trim().length < LIMITS.minMessage) errors.message = 'Tell me a little more.'
  else if (l.message.length > LIMITS.message) errors.message = `Keep it under ${LIMITS.message} characters.`
  return errors
}

const str = (v: unknown) => (typeof v === 'string' ? v : null)

/** Parse an untrusted request body into a payload, or explain why not. */
export function parsePayload(body: unknown): { ok: true; payload: LetterPayload } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'bad body' }
  const r: Record<string, unknown> = { ...body }
  const name = str(r.name)
  const email = str(r.email)
  const message = str(r.message)
  const website = str(r.website) ?? ''
  const elapsedMs = typeof r.elapsedMs === 'number' && Number.isFinite(r.elapsedMs) ? r.elapsedMs : 0
  if (name === null || email === null || message === null || !isTopicId(r.topic)) return { ok: false, error: 'missing fields' }
  const payload: LetterPayload = { name: name.trim(), email: email.trim(), topic: r.topic, message: message.trim(), website, elapsedMs }
  const errors = checkLetter(payload)
  const first = Object.values(errors)[0]
  if (first) return { ok: false, error: first }
  return { ok: true, payload }
}

/** A prefilled mailto: for when the post office can't send (no key yet, or an outage). */
export function mailtoFor(l: Letter): string {
  const subject = `${topicLabel(l.topic)} — ${l.name || 'hello'}`
  const body = `${l.message}\n\n${l.name}`
  return `mailto:${ENQUIRY_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
