/** Live movement input for explore mode: keyboard plus the touch joystick. */
export const input = {
  keys: new Set<string>(),
  /** Joystick vector, x = turn (right +), y = forward (+). Range -1..1. */
  stick: { x: 0, y: 0 },
}

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

export function isMoveKey(key: string) {
  return MOVE_KEYS.has(key.toLowerCase())
}

export function pressKey(key: string, down: boolean) {
  const k = key.toLowerCase()
  if (down) input.keys.add(k)
  else input.keys.delete(k)
}

export function clearInput() {
  input.keys.clear()
  input.stick.x = 0
  input.stick.y = 0
}

export function readAxes() {
  const k = input.keys
  const forward = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
  const turn = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
  return {
    forward: Math.max(-1, Math.min(1, forward + input.stick.y)),
    turn: Math.max(-1, Math.min(1, turn + input.stick.x)),
  }
}

export function setStick(x: number, y: number) {
  input.stick.x = x
  input.stick.y = y
}
