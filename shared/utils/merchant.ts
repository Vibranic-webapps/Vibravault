import { pickRule, type RuleLike } from './rulePick'


export function extractMerchant(description: string): string | null {
  const text = (description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (!text) return null

  if (text.startsWith('STORTING AUTOMAAT')) return 'Cash deposit'

  if (text.startsWith('BETALING VIA BANCONTACT') || text.startsWith('BETALING VIA DEBIT MASTERCARD')) {
    return text.match(/ UUR (.*?) MET /)?.[1]?.trim() || null
  }

  if (text.startsWith('EUROPESE DOMICILIERING')) {
    return text.match(/SCHULDEISER ?: ?(.*?) REF\./)?.[1]?.trim() || null
  }

  return null
}

export function transactionLabel(
  counterparty: string | null,
  description: string | null,
  rules: RuleLike[] = [],
): string {
  // Layer 1 - a rule the user taught beats every automatic guess, including
  // the bank's own name field. Only rules that carry a name take part here.
  const taught = pickRule(rules.filter((r) => r.label), description)
  if (taught?.label) return taught.label

  if (counterparty?.trim()) return counterparty.trim()

  const raw = (description ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return 'Transaction'

  return extractMerchant(raw) ?? (raw.length > 48 ? `${raw.slice(0, 48)}…` : raw)
}
