/**
 * All audio is synthesised with Web Audio (no files, no third-party music).
 * Muted by default; the AudioContext is only created from a user gesture.
 */

type Voice = { osc: OscillatorNode; gain: GainNode }

const STORAGE_KEY = 'callumdeas:sound'

const DAY_CHORDS: readonly (readonly number[])[] = [
  [53, 60, 64, 69], // Fmaj7-ish
  [48, 55, 64, 67], // Cadd9
  [50, 57, 62, 65], // Dm
  [55, 59, 62, 67], // G
]
const NIGHT_CHORDS: readonly (readonly number[])[] = [
  [45, 52, 60, 64], // Am9
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 62], // G6
  [40, 47, 55, 62], // Em7
]

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private music: GainNode | null = null
  private sfx: GainNode | null = null
  private pad: Voice[] = []
  private filter: BiquadFilterNode | null = null
  private chordTimer: number | null = null
  private chordIndex = 0
  private night = 0
  enabled = false

  /** Restore the saved preference (does not start audio until a gesture calls enable). */
  savedPreference(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      return false
    }
  }

  private save(on: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
    } catch {
      // Private mode / blocked storage: preference just won't persist.
    }
  }

  private build() {
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    // Dreamy space: a feedback delay on everything.
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.38
    const feedback = ctx.createGain()
    feedback.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    delay.connect(feedback).connect(delay)
    delay.connect(wet).connect(master)

    const music = ctx.createGain()
    music.gain.value = 0.16
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1400
    filter.Q.value = 0.6
    music.connect(filter)
    filter.connect(master)
    filter.connect(delay)

    const sfx = ctx.createGain()
    sfx.gain.value = 0.28
    sfx.connect(master)
    sfx.connect(delay)

    this.pad = Array.from({ length: 4 }, (_, i) => {
      const osc = ctx.createOscillator()
      osc.type = i % 2 === 0 ? 'triangle' : 'sine'
      osc.detune.value = (i - 1.5) * 6
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain).connect(music)
      osc.start()
      return { osc, gain }
    })

    this.ctx = ctx
    this.master = master
    this.music = music
    this.sfx = sfx
    this.filter = filter
  }

  private playChord() {
    const ctx = this.ctx
    if (!ctx) return
    const chords = this.night > 0.5 ? NIGHT_CHORDS : DAY_CHORDS
    const chord = chords[this.chordIndex % chords.length]
    this.chordIndex++
    const t = ctx.currentTime
    this.pad.forEach((v, i) => {
      v.osc.frequency.setTargetAtTime(midiToHz(chord[i]), t, 0.4)
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0.22 - i * 0.03, t, 0.9)
      v.gain.gain.setTargetAtTime(0.08, t + 4.5, 1.2)
    })
    // Occasional twinkle on top of the chord.
    const top = chord[(this.chordIndex * 3) % chord.length] + 24
    window.setTimeout(() => this.note(top, 0.05, 'sine', 1.6), 1200)
  }

  async enable() {
    if (!this.ctx) this.build()
    const ctx = this.ctx
    if (!ctx || !this.master) return
    await ctx.resume()
    this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.6)
    this.enabled = true
    this.save(true)
    if (this.chordTimer === null) {
      this.playChord()
      this.chordTimer = window.setInterval(() => this.playChord(), 7000)
    }
  }

  disable() {
    this.enabled = false
    this.save(false)
    const ctx = this.ctx
    if (!ctx || !this.master) return
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    if (this.chordTimer !== null) {
      window.clearInterval(this.chordTimer)
      this.chordTimer = null
    }
    window.setTimeout(() => {
      if (!this.enabled) void ctx.suspend()
    }, 800)
  }

  /** 0 = day, 1 = night. Night is darker, warmer and more muffled. */
  setNight(night: number) {
    this.night = night
    if (this.filter && this.ctx) this.filter.frequency.setTargetAtTime(2200 - night * 1300, this.ctx.currentTime, 2)
  }

  private note(midi: number, volume: number, type: OscillatorType, length: number, when = 0) {
    const ctx = this.ctx
    if (!ctx || !this.sfx || !this.enabled) return
    const t = ctx.currentTime + when
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = midiToHz(midi)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(volume, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(gain).connect(this.sfx)
    osc.start(t)
    osc.stop(t + length + 0.05)
  }

  hover() {
    this.note(84, 0.05, 'square', 0.06)
  }
  select() {
    this.note(72, 0.08, 'square', 0.1)
    this.note(79, 0.08, 'square', 0.1, 0.07)
    this.note(84, 0.07, 'square', 0.18, 0.14)
  }
  back() {
    this.note(79, 0.07, 'square', 0.08)
    this.note(72, 0.07, 'square', 0.14, 0.07)
  }
  tick() {
    this.note(96, 0.012, 'square', 0.02)
  }
  chime() {
    ;[76, 81, 88, 93].forEach((m, i) => this.note(m, 0.06, 'triangle', 0.6, i * 0.08))
  }
  meow() {
    const ctx = this.ctx
    if (!ctx || !this.sfx || !this.enabled) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600, t)
    osc.frequency.linearRampToValueAtTime(900, t + 0.12)
    osc.frequency.linearRampToValueAtTime(500, t + 0.45)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1200
    filter.Q.value = 3
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.12, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(filter).connect(gain).connect(this.sfx)
    osc.start(t)
    osc.stop(t + 0.55)
  }
  private noise(seconds: number, shape: (k: number) => number) {
    const ctx = this.ctx
    if (!ctx) return null
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * shape(i / data.length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    return src
  }

  /** Distant firework: a muffled boom, then crackle. `delay` lets sound lag the flash. */
  firework(volume: number, delay: number) {
    const ctx = this.ctx
    if (!ctx || !this.sfx || !this.enabled) return
    const t = ctx.currentTime + delay
    const boom = this.noise(0.9, (k) => (1 - k) ** 3)
    const crackle = this.noise(1.2, (k) => (Math.random() < 0.035 ? 1 : 0) * (1 - k))
    if (!boom || !crackle) return
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 260
    const boomGain = ctx.createGain()
    boomGain.gain.value = 0.55 * volume
    boom.connect(low).connect(boomGain).connect(this.sfx)
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 2400
    const crackleGain = ctx.createGain()
    crackleGain.gain.value = 0.22 * volume
    crackle.connect(high).connect(crackleGain).connect(this.sfx)
    boom.start(t)
    crackle.start(t + 0.12)
  }

  /** Soft filtered-noise footstep. */
  step() {
    const ctx = this.ctx
    if (!ctx || !this.sfx || !this.enabled) return
    const t = ctx.currentTime
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const gain = ctx.createGain()
    gain.gain.value = 0.18
    src.connect(filter).connect(gain).connect(this.sfx)
    src.start(t)
  }
}

export const sound = new SoundEngine()
