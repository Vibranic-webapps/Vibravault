/**
 * Every string must exist in BOTH languages. Run:  npx tsx i18n.test.mts
 * The most common i18n bug is a key added in one file and forgotten in the
 * other - the app then shows a raw key like "design.title" to the user.
 */
import { readFileSync } from 'node:fs'

type Tree = { [k: string]: string | Tree }
const load = (l: string) => JSON.parse(readFileSync(`i18n/locales/${l}.json`, 'utf8')) as Tree
function keys(t: Tree, p = ''): string[] {
  return Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : keys(v, `${p}${k}.`)))
}
function empties(t: Tree, p = ''): string[] {
  return Object.entries(t).flatMap(([k, v]) =>
    typeof v === 'string' ? (v.trim() ? [] : [p + k]) : empties(v, `${p}${k}.`))
}

const en = load('en'), nl = load('nl')
const a = new Set(keys(en)), b = new Set(keys(nl))
const missingNl = [...a].filter((k) => !b.has(k))
const missingEn = [...b].filter((k) => !a.has(k))
const blank = [...empties(en).map((k) => `en:${k}`), ...empties(nl).map((k) => `nl:${k}`)]

console.log(`  en ${a.size} strings · nl ${b.size} strings`)
if (missingNl.length) console.log('  FAIL missing in nl:', missingNl.join(', '))
if (missingEn.length) console.log('  FAIL missing in en:', missingEn.join(', '))
if (blank.length) console.log('  FAIL empty strings:', blank.join(', '))
const ok = !missingNl.length && !missingEn.length && !blank.length
console.log(ok ? '  PASS  both languages complete' : '')
if (!ok) process.exit(1)
