const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))

// Determine bump type: pass "minor" as argument for feature bumps
const bumpType = process.argv[2] === 'minor' ? 'minor' : 'patch'
const parts = pkg.version.split('.').map(Number)
const oldVer = pkg.version

if (bumpType === 'minor') {
  parts[1] += 1
  parts[2] = 0
} else {
  parts[2] += 1
}
const newVer = parts.join('.')

const now = new Date()
const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

// package.json
pkg.version = newVer
fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

// version.json
fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify({ version: newVer }, null, 2) + '\n')

// pyproject.toml
const py = fs.readFileSync(path.join(ROOT, 'pyproject.toml'), 'utf-8')
fs.writeFileSync(path.join(ROOT, 'pyproject.toml'), py.replace(/version = "[\d.]+"/, `version = "${newVer}"`))

// CHANGELOG.md — prepend new entry under "# Changelog"
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8')
const headerLine = '# Changelog\n\n'
const rest = changelog.startsWith(headerLine) ? changelog.slice(headerLine.length) : changelog
const entry = `## v${newVer} (${dateStr})

### Changes
- (auto) Version bumped from ${oldVer} to ${newVer}

${rest}`
fs.writeFileSync(path.join(ROOT, 'CHANGELOG.md'), headerLine + entry)

console.log(`Version bumped from ${oldVer} to ${newVer} (${bumpType})`)
