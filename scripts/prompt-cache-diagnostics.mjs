#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_DB = join(homedir(), 'Library/Application Support/tanzo/tanzo.sqlite')

function usage() {
  console.error(
    [
      'Usage: pnpm diagnose:prompt-cache <conversationId> [--limit 20] [--db /path/to/tanzo.sqlite]',
      '',
      'Shows prompt cache diagnostics captured before each model step.'
    ].join('\n')
  )
}

function parseArgs(argv) {
  const out = { db: DEFAULT_DB, limit: 20, chatId: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--db') out.db = argv[++i] ?? out.db
    else if (arg === '--limit') out.limit = Number(argv[++i] ?? out.limit)
    else if (!out.chatId) out.chatId = arg
  }
  return out
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqliteJson(db, query) {
  const output = execFileSync('sqlite3', ['-json', db, query], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
  return output ? JSON.parse(output) : []
}

function pad(value, width) {
  const text = String(value ?? '')
  return text.length >= width ? text.slice(0, width) : text.padEnd(width, ' ')
}

function percent(row) {
  if (!row.input_tokens) return ''
  return `${((100 * (row.cache_read_tokens ?? 0)) / row.input_tokens).toFixed(1)}%`
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function segmentOrigin(segment) {
  if (typeof segment.origin === 'string' && segment.origin.length > 0) return segment.origin
  if (segment.sectionId || Array.isArray(segment.sections)) return 'context-section'
  return `legacy:${segment.kind ?? 'unknown'}`
}

function segmentProvenance(segment) {
  if (segment.sectionId) {
    return `section=${segment.sectionId}/${segment.stability ?? '?'}/${segment.channel ?? '?'}`
  }
  if (Array.isArray(segment.sections) && segment.sections.length > 0) {
    return `sections=${segment.sections
      .map(
        (section) =>
          `${section.sectionId ?? '?'}/${section.stability ?? '?'}/${section.channel ?? '?'}`
      )
      .join(',')}`
  }
  return ''
}

function segmentContext(segment) {
  const provenance = segmentProvenance(segment)
  return provenance ? `${segmentOrigin(segment)}; ${provenance}` : segmentOrigin(segment)
}

function diffSide(label, origin) {
  if (!label) return '-'
  return origin ? `${label} (${origin})` : label
}

const args = parseArgs(process.argv.slice(2))
if (!args.chatId || !Number.isFinite(args.limit) || args.limit <= 0) {
  usage()
  process.exit(1)
}

const table = sqliteJson(
  args.db,
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompt_diagnostics'"
)
if (table.length === 0) {
  console.error('prompt_diagnostics table not found. Run the app once after unified schema setup.')
  process.exit(1)
}

const rows = sqliteJson(
  args.db,
  `
  SELECT
    datetime(prompt_diagnostics.created_at / 1000, 'unixepoch', 'localtime') AS at,
    runs.external_run_id AS run_id,
    run_steps.step_number,
    run_steps.input_tokens,
    run_steps.cache_read_tokens,
    run_steps.cache_write_tokens,
    prompt_diagnostics.prompt_hash,
    prompt_diagnostics.system_hash,
    prompt_diagnostics.messages_hash,
    prompt_diagnostics.tools_hash,
    json_extract(prompt_diagnostics.diff_json, '$.commonPrefixSegments') AS common_prefix,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.index') AS diff_index,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.previous.label') AS previous_label,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.current.label') AS current_label,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.previous.origin') AS previous_origin,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.current.origin') AS current_origin,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.previous.hash') AS previous_hash,
    json_extract(prompt_diagnostics.diff_json, '$.firstDifference.current.hash') AS current_hash,
    prompt_diagnostics.segments_json,
    run_steps.finish_reason
  FROM prompt_diagnostics
  INNER JOIN run_steps ON run_steps.id = prompt_diagnostics.run_step_id
  INNER JOIN runs ON runs.id = run_steps.run_id
  WHERE runs.conversation_id = ${sql(args.chatId)}
  ORDER BY prompt_diagnostics.created_at DESC
  LIMIT ${Math.floor(args.limit)}
  `
).reverse()

if (rows.length === 0) {
  console.error(`No prompt cache diagnostics found for ${args.chatId}.`)
  process.exit(1)
}

console.log(`conversation: ${args.chatId}`)
console.log(`db: ${args.db}`)
console.log('')
console.log(
  [
    pad('time', 19),
    pad('step', 4),
    pad('input', 7),
    pad('cached', 7),
    pad('hit', 7),
    pad('prompt', 16),
    pad('common', 6),
    'first-diff'
  ].join('  ')
)
console.log('-'.repeat(104))

for (const row of rows) {
  const diff =
    row.diff_index == null
      ? ''
      : `${row.diff_index}: ${diffSide(row.previous_label, row.previous_origin)} -> ${diffSide(row.current_label, row.current_origin)}`
  console.log(
    [
      pad(row.at, 19),
      pad(row.step_number, 4),
      pad(row.input_tokens ?? '', 7),
      pad(row.cache_read_tokens ?? '', 7),
      pad(percent(row), 7),
      pad(row.prompt_hash, 16),
      pad(row.common_prefix ?? '', 6),
      diff
    ].join('  ')
  )
}

const latest = rows[rows.length - 1]
console.log('')
console.log('latest hashes:')
console.log(
  `  system=${latest.system_hash} messages=${latest.messages_hash} tools=${latest.tools_hash}`
)
if (latest.diff_index != null) {
  console.log(
    `  first-diff=${latest.diff_index} previous=${diffSide(latest.previous_label, latest.previous_origin)}:${latest.previous_hash ?? '-'} current=${diffSide(latest.current_label, latest.current_origin)}:${latest.current_hash ?? '-'}`
  )
}

const latestSegments = parseJson(latest.segments_json, [])
if (Array.isArray(latestSegments) && latestSegments.length > 0) {
  console.log('')
  console.log('latest segments:')
  console.log(
    [pad('#', 3), pad('kind', 16), pad('label', 30), pad('chars', 7), 'origin/provenance'].join(
      '  '
    )
  )
  console.log('-'.repeat(104))
  latestSegments.forEach((segment, index) => {
    console.log(
      [
        pad(index, 3),
        pad(segment.kind ?? '', 16),
        pad(segment.label ?? '', 30),
        pad(segment.chars ?? '', 7),
        segmentContext(segment)
      ].join('  ')
    )
  })
}
