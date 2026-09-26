function clean(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const MIN_MATCH_LENGTH = 3

export function ruleMatches(match: string, description: string | null): boolean {
  const needle = clean(match)

  if (needle.length < MIN_MATCH_LENGTH) return false

  const haystack = clean(description)
  if (!haystack) return false

  return haystack.includes(needle)
}
