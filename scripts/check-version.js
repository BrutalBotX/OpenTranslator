const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const vjson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf-8'))
const py = fs.readFileSync(path.join(ROOT, 'pyproject.toml'), 'utf-8')
const pyVer = py.match(/version = "([\d.]+)"/)

const errors = []
if (pkg.version !== vjson.version) errors.push(`package.json (${pkg.version}) != version.json (${vjson.version})`)
if (pyVer && pyVer[1] !== pkg.version) errors.push(`package.json (${pkg.version}) != pyproject.toml (${pyVer[1]})`)

if (errors.length > 0) {
  console.error('VERSION MISMATCH:')
  errors.forEach(e => console.error(`  - ${e}`))
  console.error('\nRun npm run version:bump first!')
  process.exit(1)
}

console.log(`Version ${pkg.version} — all files in sync`)
