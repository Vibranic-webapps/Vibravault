/**
 * Open/close state of the "New transaction" sheet. It lives in the app shell
 * (layouts/default.vue), so the + button's "Type it in" opens it right where
 * you are - no jump to the Transactions screen first. Any screen can open it
 * with `useAddTransaction().show()`.
 */
export const useAddTransaction = () => {
  const open = useState<boolean>('vv-add-tx', () => false)
  return { open, show: () => { open.value = true } }
}
