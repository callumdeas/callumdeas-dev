'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { track } from './analytics'
import { LIMITS, TOPICS, checkLetter, isTopicId, mailtoFor, type EnquiryResult, type FieldErrors, type Letter } from './enquiry'

/**
 * The enquiry form. One component, two looks: the retro panel on the planet
 * and plain HTML in the text version. The draft lives at module level so
 * flicking PREV/NEXT through the planet's places never loses a half-written letter.
 */

let draft: Letter = { name: '', email: '', topic: 'website', message: '' }

type Phase = 'writing' | 'sending' | 'sent' | 'fallback'

type Look = {
  label: CSSProperties
  input: CSSProperties
  error: CSSProperties
  button: CSSProperties
  note: CSSProperties
  link: CSSProperties
}

const RETRO: Look = {
  label: { fontSize: '1.125rem', opacity: 0.75 },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '2px solid rgba(255,255,255,0.4)',
    color: '#fff',
    fontSize: '1.25rem',
    lineHeight: 1.2,
    padding: '6px 8px',
  },
  error: { color: '#ffb0a0', fontSize: '1.05rem' },
  button: { background: '#ff9d6c', color: '#120e1c', boxShadow: '3px 3px 0 rgba(0,0,0,0.5)', fontSize: '1.5rem', padding: '6px 14px' },
  note: { fontSize: '1.05rem', opacity: 0.6 },
  link: { color: '#ff9d6c', textDecoration: 'underline', textUnderlineOffset: 4 },
}

const PLAIN: Look = {
  label: { fontSize: '0.8rem', color: '#a6adc8' },
  input: { background: '#181825', border: '1px solid #45475a', color: '#cdd6f4', fontSize: '0.9rem', padding: '8px 10px', borderRadius: 4 },
  error: { color: '#f38ba8', fontSize: '0.75rem' },
  button: { background: '#ff9d6c', color: '#11111b', fontSize: '0.9rem', padding: '8px 16px', borderRadius: 4, fontWeight: 600 },
  note: { fontSize: '0.75rem', color: '#7f849c' },
  link: { color: '#89b4fa', textDecoration: 'underline', textUnderlineOffset: 4 },
}

function Field({ label, error, look, children }: { label: string; error?: string; look: Look; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block" style={look.label}>
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block" style={look.error} role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

async function post(letter: Letter, elapsedMs: number, website: string): Promise<EnquiryResult> {
  try {
    const res = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...letter, website, elapsedMs }),
    })
    const body: unknown = await res.json()
    if (typeof body === 'object' && body !== null && 'status' in body) {
      const s = body.status
      if (s === 'sent' || s === 'unconfigured' || s === 'failed') return { status: s }
      if (s === 'invalid') return { status: 'invalid', error: 'error' in body && typeof body.error === 'string' ? body.error : 'Please check the form.' }
    }
    return { status: 'failed' }
  } catch {
    return { status: 'failed' }
  }
}

export function EnquiryForm({ variant, onSent }: { variant: 'retro' | 'plain'; onSent?: () => void }) {
  const look = variant === 'retro' ? RETRO : PLAIN
  const [letter, setLetter] = useState<Letter>(draft)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [phase, setPhase] = useState<Phase>('writing')
  const [serverError, setServerError] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  const openedAt = useRef(0)
  const counted = useRef(false)

  // The planet's panel counts as opened when shown. The text version's form is
  // always in the DOM (hidden under the planet), so it counts on first focus instead.
  useEffect(() => {
    openedAt.current = Date.now()
    if (variant === 'retro') {
      counted.current = true
      track('enquiry_opened', { variant })
    }
  }, [variant])

  const onFirstFocus = () => {
    if (counted.current) return
    counted.current = true
    openedAt.current = Date.now()
    track('enquiry_opened', { variant })
  }

  const update = (patch: Partial<Letter>) => {
    const next = { ...letter, ...patch }
    draft = next
    setLetter(next)
    if (Object.keys(errors).length > 0) setErrors(checkLetter(next))
  }

  const submit = async () => {
    const found = checkLetter(letter)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return
    setPhase('sending')
    const result = await post(letter, Date.now() - openedAt.current, website)
    if (result.status === 'sent') {
      draft = { name: letter.name, email: letter.email, topic: letter.topic, message: '' }
      setPhase('sent')
      track('enquiry_sent', { topic: letter.topic, variant })
      onSent?.()
    } else if (result.status === 'invalid') {
      setPhase('writing')
      setServerError(result.error)
      track('enquiry_failed', { reason: 'invalid', variant })
    } else {
      setPhase('fallback')
      track('enquiry_failed', { reason: result.status, variant })
    }
  }

  if (phase === 'sent') {
    return (
      <div role="status" className="py-2">
        <p style={{ ...look.label, opacity: 1, fontSize: variant === 'retro' ? '1.5rem' : '1rem' }}>✉ Posted! Your letter is on its way.</p>
        <p className="mt-2" style={look.note}>
          I’ll reply to {letter.email}.{' '}
          <button type="button" className="cursor-pointer" style={look.link} onClick={() => setPhase('writing')}>
            Write another
          </button>
        </p>
      </div>
    )
  }

  if (phase === 'fallback') {
    return (
      <div role="status" className="py-2">
        <p style={{ ...look.label, opacity: 1 }}>The post office is closed right now, so here’s the next best thing:</p>
        <a href={mailtoFor(letter)} className="mt-3 inline-block" style={look.button}>
          ✉ Open in your email app
        </a>
        <p className="mt-3" style={look.note}>
          Your letter is copied in, ready to send.{' '}
          <button type="button" className="cursor-pointer" style={look.link} onClick={() => setPhase('writing')}>
            Back to the form
          </button>
        </p>
      </div>
    )
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onFocus={onFirstFocus}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Field label="YOUR NAME" error={errors.name} look={look}>
        <input
          className="w-full"
          style={look.input}
          value={letter.name}
          maxLength={LIMITS.name}
          autoComplete="name"
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <Field label="YOUR EMAIL" error={errors.email} look={look}>
        <input
          className="w-full"
          style={look.input}
          type="email"
          value={letter.email}
          maxLength={LIMITS.email}
          autoComplete="email"
          onChange={(e) => update({ email: e.target.value })}
        />
      </Field>
      <Field label="WHAT’S IT ABOUT?" look={look}>
        <select
          className="w-full cursor-pointer"
          style={look.input}
          value={letter.topic}
          onChange={(e) => {
            const v = e.target.value
            if (isTopicId(v)) update({ topic: v })
          }}
        >
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id} style={{ color: '#120e1c' }}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="YOUR LETTER" error={errors.message} look={look}>
        <textarea
          className="block w-full resize-y"
          style={{ ...look.input, minHeight: '7em' }}
          value={letter.message}
          maxLength={LIMITS.message}
          onChange={(e) => update({ message: e.target.value })}
        />
      </Field>
      {/* Honeypot: off-screen for people, still in the form for bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {serverError && (
        <p style={look.error} role="alert">
          {serverError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="cursor-pointer disabled:opacity-60" style={look.button} disabled={phase === 'sending'}>
          {phase === 'sending' ? 'POSTING…' : '✉ POST IT'}
        </button>
        <span style={look.note}>Goes straight to Callum’s inbox.</span>
      </div>
    </form>
  )
}
