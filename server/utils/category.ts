/** Shared validation for create + update, so the two can't drift apart. */
export function validateCategoryInput(body: any) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const kind = body?.kind
  const icon = typeof body?.icon === 'string' ? body.icon.trim() : ''
  const color = typeof body?.color === 'string' ? body.color.trim() : ''

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  if (name.length > 40) throw createError({ statusCode: 400, statusMessage: 'Name is too long' })
  if (kind !== 'INCOME' && kind !== 'EXPENSE') {
    throw createError({ statusCode: 400, statusMessage: 'Kind must be INCOME or EXPENSE' })
  }
  // Only the 12 curated tints are allowed - the palette rule enforced server-side,
  // not just by which swatches the UI happens to render.
  if (!/^cat-(1[0-2]|[1-9])$/.test(color)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown colour' })
  }
  if (!icon || [...icon].length > 4) {
    throw createError({ statusCode: 400, statusMessage: 'Pick an icon' })
  }

  return { name, kind, icon, color } as const
}
