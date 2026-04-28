#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('..', import.meta.url)
const rootPath = root.pathname
const distPath = join(rootPath, 'dist')

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units.shift()
  while (value >= 1024 && units.length > 0) {
    value /= 1024
    unit = units.shift()
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`
}

async function listLargestDistFiles(limit = 12) {
  if (!existsSync(distPath)) return []
  const names = await readdir(distPath)
  return names
    .filter(name => name.endsWith('.js'))
    .map(name => {
      const path = join(distPath, name)
      return { path: `dist/${name}`, size: statSync(path).size }
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
}

async function readDistJavaScript() {
  if (!existsSync(distPath)) return ''
  const names = await readdir(distPath)
  const chunks = await Promise.all(
    names
      .filter(name => name.endsWith('.js'))
      .map(name => readFile(join(distPath, name), 'utf8').catch(() => '')),
  )
  return chunks.join('\n')
}

function runPackDryRun() {
  const result = spawnSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    {
      cwd: rootPath,
      env: { ...process.env, NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || '/tmp/npm-cache' },
      encoding: 'utf8',
    },
  )
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout)
    process.exit(result.status ?? 1)
  }
  return JSON.parse(result.stdout)[0]
}

function countMatching(files, pattern) {
  return files.filter(file => pattern.test(file.path)).length
}

function countText(text, pattern) {
  return text.match(pattern)?.length ?? 0
}

const pack = runPackDryRun()
const files = pack.files ?? []
const largest = await listLargestDistFiles()
const distText = await readDistJavaScript()
const postinstallPath = join(rootPath, 'scripts', 'postinstall.cjs')
const postinstallText = existsSync(postinstallPath)
  ? readFileSync(postinstallPath, 'utf8')
  : ''

console.log(`package: ${pack.name}@${pack.version}`)
console.log(`tarball: ${formatBytes(pack.size)}`)
console.log(`unpacked: ${formatBytes(pack.unpackedSize)}`)
console.log(`entries: ${pack.entryCount}`)
console.log('')
console.log('largest dist chunks:')
for (const file of largest) {
  console.log(`  ${formatBytes(file.size).padStart(9)}  ${file.path}`)
}
console.log('')
console.log('risk markers:')
console.log(`  audio native files: ${countMatching(files, /^dist\/vendor\/audio-capture\/.*\.node$/)}`)
console.log(`  ripgrep files: ${countMatching(files, /^dist\/vendor\/ripgrep\//)}`)
console.log(`  sentry/opentelemetry/langfuse chunks: ${countMatching(files, /(@sentry|@opentelemetry|@langfuse|sentry|opentelemetry|langfuse)/i)}`)
console.log(`  highlight chunks: ${countMatching(files, /highlight/i)}`)
console.log(`  stub command markers: ${countText(distText, /\bname:\s*["']stub["']/g)}`)
console.log(`  snip/context no-op markers: ${countText(distText, /isSnipRuntimeEnabled|snipCompactIfNeeded|Context inspection requires|isContextCollapseEnabled/g)}`)
console.log(`  direct-connect markers: ${countText(distText, /class\s+DirectConnectSessionManager|src\/server\/createDirectConnectSession|src\/server\/directConnectManager/g)}`)
console.log(`  stale audio fallback markers: ${countText(distText, /\.\.\/audio-capture\//g)}`)
console.log(
  `  postinstall ripgrep downloader: ${
    /RIPGREP_DOWNLOAD_BASE|microsoft\/ripgrep-prebuilt/.test(postinstallText)
      ? 'present'
      : 'absent'
  }`,
)
