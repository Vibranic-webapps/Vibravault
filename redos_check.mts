// Kilian's two patterns, attacked with long hostile input that never completes a match.
const bancontact = /BETALING VIA BANCONTACT.*?UUR (.*?) MET KBC-DEBETKAART/
const domicil    = /SCHULDEISER\s*:\s*(.*?)\s+REF\./

// Classic ReDoS shape for comparison: nested quantifiers
const dangerous  = /^(a+)+$/

function time(label: string, re: RegExp, input: string) {
  const t0 = performance.now(); re.test(input); const ms = performance.now() - t0
  console.log(`  ${label.padEnd(38)} ${ms.toFixed(2).padStart(9)} ms`)
}

for (const n of [500, 5_000, 50_000]) {
  const hostile1 = 'BETALING VIA BANCONTACT ' + 'UUR '.repeat(n / 4)   // lots of UUR, never MET...
  const hostile2 = 'SCHULDEISER : ' + ' '.repeat(n)                    // endless whitespace, no REF.
  console.log(`input length ~${n}:`)
  time('your bancontact pattern', bancontact, hostile1)
  time('your domiciliering pattern', domicil, hostile2)
}
console.log('\nfor comparison - a genuinely dangerous pattern:')
for (const n of [20, 24, 28]) time(`/^(a+)+$/ on ${n} chars`, dangerous, 'a'.repeat(n) + '!')
