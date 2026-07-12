const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const parts = pkg.version.split('.').map(Number)
parts[2] += 1
const newVer = parts.join('.')

// package.json
pkg.version = newVer
fs.writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

// version.json
fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify({ version: newVer }, null, 2) + '\n')

// pyproject.toml
const py = fs.readFileSync(path.join(ROOT, 'pyproject.toml'), 'utf-8')
fs.writeFileSync(path.join(ROOT, 'pyproject.toml'), py.replace(/version = "[\d.]+"/, `version = "${newVer}"`))

console.log(`Version bumped to ${newVer}`)
