import { ENQUIRY_TO, MIN_FILL_MS, parsePayload, topicLabel, type EnquiryResult } from '../../_lib/enquiry'

/**
 * The post office: sends a visitor's letter to Callum via Resend.
 *
 * Needs the RESEND_API_KEY Worker secret (`wrangler secret put RESEND_API_KEY`)
 * and callumdeas.dev verified as a sending domain in Resend. Without the key it
 * answers `unconfigured` and the form falls back to a prefilled mailto: link.
 */

const FROM = 'Planet Post Office <post@callumdeas.dev>'
const MAX_BODY = 16_000

const reply = (result: EnquiryResult, status = 200) => Response.json(result, { status })

/** Only accept letters posted from this site's own pages. */
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ status: 'invalid', error: 'Wrong post office.' }, 403)

  const raw = await request.text()
  if (raw.length > MAX_BODY) return reply({ status: 'invalid', error: 'That letter is too long.' }, 413)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return reply({ status: 'invalid', error: 'Couldn’t read that letter.' }, 400)
  }

  const parsed = parsePayload(body)
  if (!parsed.ok) return reply({ status: 'invalid', error: parsed.error }, 400)
  const letter = parsed.payload

  // Bots fill the honeypot: pretend it worked so they move on.
  if (letter.website) return reply({ status: 'sent' })
  // Suspiciously fast (bot, or autofill + paste): still deliver, but flag it.
  // A lost real enquiry costs more than one spam email.
  const fast = letter.elapsedMs < MIN_FILL_MS

  const key = process.env.RESEND_API_KEY
  if (!key) return reply({ status: 'unconfigured' })

  const text = [
    `From: ${letter.name} <${letter.email}>`,
    `About: ${topicLabel(letter.topic)}`,
    '',
    letter.message,
    '',
    '— posted at the callumdeas.dev post office',
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [ENQUIRY_TO],
        reply_to: letter.email,
        subject: `${fast ? '[fast] ' : ''}✉ ${topicLabel(letter.topic)} — ${letter.name}`,
        // Plain text only: nothing the visitor typed is ever rendered as HTML.
        text,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('enquiry: resend responded', res.status, await res.text())
      return reply({ status: 'failed' }, 502)
    }
    return reply({ status: 'sent' })
  } catch (err) {
    console.error('enquiry: send failed', err)
    return reply({ status: 'failed' }, 502)
  }
}
