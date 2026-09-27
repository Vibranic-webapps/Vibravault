import { prisma } from '~~/server/utils/prisma'
import { prismaLive } from '~~/server/utils/transactionQuery'
import { requireUserId } from '~~/server/utils/auth'
import { loadRules } from '~~/server/utils/merchantRules'
import { transactionLabel } from '~~/shared/utils/merchant'

/**
 * "Export my transactions" - every live transaction as a CSV file.
 *
 * Belgian spreadsheet format, same as the KBC export: `;` between columns,
 * decimal COMMA, UTF-8 with a BOM so Excel shows é and € correctly. Column
 * headers follow ?lang=nl|en.
 */
const HEADERS = {
  en: ['Date', 'Amount', 'Name', 'Category', 'Description', 'Source'],
  nl: ['Datum', 'Bedrag', 'Naam', 'Categorie', 'Omschrijving', 'Bron'],
}

// A cell starting with = + - @ is run as a FORMULA by Excel. A bank text
// or a name you typed could start that way ("=HYPERLINK(...)"), so text
// cells get a leading ' - the standard CSV-injection guard.
function text(value: string | null | undefined): string {
  let v = (value ?? '').replace(/\s+/g, ' ').trim()
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// Integer cents -> "-1234,56". String maths, never floats.
function amount(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const lang = getQuery(event).lang === 'nl' ? 'nl' : 'en'

  const [rows, rules, cats] = await Promise.all([
    prismaLive.transaction.findMany({
      where: { userId },
      orderBy: [{ bookedAt: 'asc' }, { createdAt: 'asc' }],
      select: { bookedAt: true, amountCents: true, counterparty: true, description: true, categoryId: true, source: true },
    }),
    loadRules(userId),
    prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
  ])
  const catName = new Map(cats.map((c) => [c.id, c.name]))

  const lines = [
    HEADERS[lang].join(';'),
    ...rows.map((r) => [
      r.bookedAt.toISOString().slice(0, 10),
      amount(r.amountCents),
      text(transactionLabel(r.counterparty, r.description, rules)),
      text(r.categoryId ? catName.get(r.categoryId) : ''),
      text(r.description),
      r.source,
    ].join(';')),
  ]

  const today = new Date().toISOString().slice(0, 10)
  setResponseHeaders(event, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="vibravault-${today}.csv"`,
    'cache-control': 'no-store',
  })
  return `﻿${lines.join('\r\n')}\r\n`
})
