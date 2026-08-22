export type ActionHotkey = 'MOVE' | 'EXPLORE' | 'STAY' | 'END_TURN'

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Number-row and numpad — use `event.code` so layout/shift does not matter. */
export function actionHotkey(code: string): ActionHotkey | null {
  if (code === 'Digit1' || code === 'Numpad1') return 'MOVE'
  if (code === 'Digit2' || code === 'Numpad2') return 'EXPLORE'
  if (code === 'Digit3' || code === 'Numpad3') return 'STAY'
  if (code === 'Digit9' || code === 'Numpad9') return 'END_TURN'
  return null
}
