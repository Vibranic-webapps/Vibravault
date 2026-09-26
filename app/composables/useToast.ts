/**
 * Brief confirmations ("Saved", "3 transactions filed") shown at the top of
 * the screen and gone again after a few seconds.
 *
 * useState makes the list shared app-wide, so any page or component can
 * raise a toast and the single <UiToaster> in the layout shows it.
 */
export interface Toast {
  id: number
  message: string
  tone: 'good' | 'bad' | 'plain'
}

let nextId = 1

export function useToast() {
  const toasts = useState<Toast[]>('vv-toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function toast(message: string, tone: Toast['tone'] = 'good', ms = 3200) {
    const id = nextId++
    toasts.value = [...toasts.value, { id, message, tone }]
    if (import.meta.client) setTimeout(() => dismiss(id), ms)
    return id
  }

  return { toasts, toast, dismiss }
}
