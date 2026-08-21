export type ActionHotkey = 'MOVE' | 'EXPLORE' | 'STAY'

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Number-row and numpad 1/2/3 — use `event.code` so layout/shift does not matter. */
export function actionHotkey(code: string): ActionHotkey | null {
  if (code === 'Digit1' || code === 'Numpad1') return 'MOVE'
  if (code === 'Digit2' || code === 'Numpad2') return 'EXPLORE'
  if (code === 'Digit3' || code === 'Numpad3') return 'STAY'
  return null
}
