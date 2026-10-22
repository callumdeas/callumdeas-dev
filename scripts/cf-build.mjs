// Build the Worker bundle (OpenNext → .open-next/) without leaking local .env values.
//
// OpenNext copies every .env* value in the project dir into the Worker as
// .open-next/cloudflare/next-env.mjs, and Next inlines NEXT_PUBLIC_* values from
// .env files into the bundles. So this script:
//   1. refuses to build if a local .env file sets any NEXT_PUBLIC_* var (the site
//      uses none — anything there would be baked into the client bundle);
//   2. empties next-env.mjs after the build;
//   3. scans the whole output for any local .env value and fails on a hit.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const outputDir = join(appDir, '.open-next')

function fail(message) {
  console.error(`cf-build: ${message}`)
  process.exit(1)
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}

const envFiles = readdirSync(appDir)
  .filter((name) => name.startsWith('.env') && name !== '.env.example' && !name.endsWith('.bak'))
  .map((name) => join(appDir, name))
  .filter((path) => statSync(path).isFile())
const localVars = envFiles.map((path) => parseEnv(readFileSync(path, 'utf8')))

const publicVars = [
  ...new Set(localVars.flatMap((vars) => Object.keys(vars).filter((key) => key.startsWith('NEXT_PUBLIC_')))),
]
if (publicVars.length > 0) {
  fail(`local .env files set ${publicVars.join(', ')}, which would be baked into the build. Remove them.`)
}

const build = spawnSync('opennextjs-cloudflare', ['build'], { cwd: appDir, stdio: 'inherit' })
if (build.error) fail(`could not run opennextjs-cloudflare (${build.error.message}) — run via pnpm`)
if (build.status !== 0) process.exit(build.status ?? 1)

const nextEnvPath = join(outputDir, 'cloudflare', 'next-env.mjs')
if (!existsSync(nextEnvPath)) fail(`expected ${nextEnvPath} after the build — has OpenNext changed?`)
writeFileSync(
  nextEnvPath,
  '// Emptied by scripts/cf-build.mjs: no .env file values ship in the Worker.\n' +
    'export const production = {};\nexport const development = {};\nexport const test = {};\n',
)

const needles = [...new Set(localVars.flatMap((vars) => Object.values(vars)).filter((v) => v.length >= 8))]
const leaks = []
for (const path of walk(outputDir)) {
  const text = readFileSync(path, 'latin1')
  if (needles.some((needle) => text.includes(needle))) leaks.push(path)
}
if (leaks.length > 0) fail(`local .env values found in the build output:\n  ${leaks.join('\n  ')}`)

console.log(`cf-build: build ready; checked ${envFiles.length} local .env file(s), none leaked into .open-next/.`)
