// Reads dist/assets, sizes every file raw and gzipped, and compares the JS and
// CSS totals and the initial JS (what a first visit loads before any page)
// against a baseline. Node built-ins only, no dependencies.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { constants as zlibConstants, gzipSync } from 'node:zlib'

function readArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

const distDir = readArg('dist', 'dist')
const baselinePath = readArg('baseline', 'scripts/baseline/bundle.json')
const reportPath = readArg('report', null)
const assetsDir = join(distDir, 'assets')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

let files
try {
  files = walk(assetsDir)
} catch (err) {
  console.error(`cannot read ${assetsDir}: ${err.message}`)
  process.exit(1)
}

const rows = files
  .map((full) => {
    const buf = readFileSync(full)
    const gzip = gzipSync(buf, { level: zlibConstants.Z_BEST_COMPRESSION }).length
    const ext = extname(full).slice(1).toLowerCase()
    return { path: relative(distDir, full).split('\\').join('/'), raw: buf.length, gzip, ext }
  })
  .sort((a, b) => a.path.localeCompare(b.path))

function totalOf(ext, key) {
  return rows.filter((r) => r.ext === ext).reduce((sum, r) => sum + r[key], 0)
}

// The scripts index.html loads up front: the module entry and the chunks it
// preloads. Pages load on demand, so a page pulled back into these files grows
// the initial JS even when the total stays flat.
function initialScripts() {
  let html
  try {
    html = readFileSync(join(distDir, 'index.html'), 'utf8')
  } catch {
    return []
  }
  const paths = []
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const entry = /^<script\b/i.test(tag) && /\btype=["']module["']/i.test(tag)
    const preload = /^<link\b/i.test(tag) && /\brel=["']modulepreload["']/i.test(tag)
    const url = /\b(?:src|href)=["']([^"']+)["']/i.exec(tag)
    if ((entry || preload) && url) paths.push(url[1].replace(/^\.?\//, ''))
  }
  return paths
}

const initial = new Set(initialScripts())
const initialRows = rows.filter((r) => initial.has(r.path))

const totals = {
  jsRaw: totalOf('js', 'raw'),
  jsGzip: totalOf('js', 'gzip'),
  cssRaw: totalOf('css', 'raw'),
  cssGzip: totalOf('css', 'gzip'),
  initialJsRaw: initialRows.reduce((sum, r) => sum + r.raw, 0),
  initialJsGzip: initialRows.reduce((sum, r) => sum + r.gzip, 0),
  overallRaw: rows.reduce((sum, r) => sum + r.raw, 0),
  overallGzip: rows.reduce((sum, r) => sum + r.gzip, 0),
}

let baseline
try {
  baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
} catch (err) {
  console.error(`cannot read baseline ${baselinePath}: ${err.message}`)
  process.exit(1)
}

const budgetPercent = typeof baseline.budgetPercent === 'number' ? baseline.budgetPercent : 3
let failed = false
const budgetLines = []
if (initialRows.length === 0 || initialRows.length !== initial.size) {
  failed = true
  budgetLines.push(`initial JS: dist/index.html names ${initial.size} script(s), ${initialRows.length} found under dist/assets`)
}
for (const [label, key] of [['JS', 'jsRaw'], ['CSS', 'cssRaw'], ['Initial JS', 'initialJsRaw']]) {
  const base = baseline.totals && baseline.totals[key]
  const now = totals[key]
  if (!base) {
    budgetLines.push(`${label} raw ${now} B: no baseline total to compare`)
    continue
  }
  const limit = Math.floor(base * (1 + budgetPercent / 100))
  if (now > limit) {
    failed = true
    budgetLines.push(`${label} raw ${now} B exceeds the budget of ${limit} B (baseline ${base} B + ${budgetPercent}%)`)
  } else if (now < base) {
    budgetLines.push(`${label} raw ${now} B is under the baseline of ${base} B: can tighten`)
  } else {
    budgetLines.push(`${label} raw ${now} B is within budget (baseline ${base} B + ${budgetPercent}%, limit ${limit} B)`)
  }
}

for (const r of rows) {
  console.log(`${String(r.raw).padStart(10)}  ${String(r.gzip).padStart(10)} gz  ${r.path}`)
}
console.log('')
for (const line of budgetLines) console.log(line)
console.log(
  `Summary: JS ${totals.jsRaw} B raw / ${totals.jsGzip} B gz (initial ${totals.initialJsRaw} B raw), ` +
    `CSS ${totals.cssRaw} B raw / ${totals.cssGzip} B gz, ` +
    `${rows.length} files, ${totals.overallRaw} B total raw / ${totals.overallGzip} B total gz`,
)

if (reportPath) {
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, JSON.stringify({ totals, budgetPercent, files: rows }, null, 2))
}

process.exit(failed ? 1 : 0)
