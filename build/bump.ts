import { writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { SemVer, gt, gte } from 'semver'
import chalk from 'chalk'
import globby from 'globby'
import CAC from 'cac'

const { args, options } = CAC()
  .option('-1, --major', '')
  .option('-2, --minor', '')
  .option('-3, --patch', '')
  .option('-o, --only', '')
  .option('-c, --confirm', '')
  .parse()

type VersionFlag = 'major' | 'minor' | 'patch'

interface Version {
  major: number
  minor: number
  patch: number
  alpha?: number
}

interface PackageJSON {
  name: string
  private?: boolean
  version: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

function toVersion (version: Version) {
  return `${version.major}.${version.minor}.${version.patch}${
    typeof version.alpha === 'number' ? `-alpha.${version.alpha}` : ''
  }`
}

class Package {
  pkgName: string
  major: number
  minor: number
  patch: number
  alpha: number
  current: PackageJSON
  previous: PackageJSON
  newVersion: string

  constructor (public name: string) {
    this.current = require(`../${name}/package.json`)
    this.previous = JSON.parse(execSync('git show HEAD:package.json', {
      cwd: resolve(__dirname, `../${name}`),
      encoding: 'utf8',
      stdio: ['ignore'],
    }))
    const verion = new SemVer(this.previous.version)
    this.pkgName = this.current.name
    this.major = verion.major
    this.minor = verion.minor
    this.patch = verion.patch
    this.alpha = verion.prerelease[1] as number
    this.newVersion = this.current.version
  }

  bump (flag: VersionFlag) {
    const result = {
      major: this.major,
      minor: this.minor,
      patch: this.patch,
      alpha: this.alpha,
    }
    if (typeof this.alpha === 'number') {
      result.alpha += 1
    } else {
      result[flag] += 1
      if (flag !== 'patch') result.patch = 0
      if (flag === 'major') result.minor = 0
    }
    if (gt(toVersion(result), this.newVersion)) {
      this.newVersion = toVersion(result)
    }
  }

  save () {
    writeFileSync(
      resolve(__dirname, `../${this.name}/package.json`),
      JSON.stringify(this.toJSON(), null, 2),
    )
  }

  toJSON () {
    this.current.version = this.newVersion
    return this.current
  }
}

const packages: Record<string, Package> = {}

globby.sync(require('../package').workspaces, {
  deep: 0,
  onlyDirectories: true,
}).forEach((name) => {
  try {
    packages[name] = new Package(name)
  } catch (error) { /* pass */ }
})

const packageNames = Object.keys(packages)

function each (callback: (pkg: Package, name: string) => any) {
  packageNames.forEach(name => callback(packages[name], name))
}

function bumpPkg (name: string, flag: VersionFlag = 'patch', stop = false) {
  const pkg = packages[name]
  if (!pkg) return
  pkg.bump(flag)
  each(({ current }) => {
    Object.keys(current.devDependencies || {}).forEach((name) => {
      if (name !== pkg.name) return
      current.devDependencies[name] = '^' + pkg.newVersion
    })
    Object.keys(current.dependencies || {}).forEach((name) => {
      if (name !== pkg.name) return
      current.dependencies[name] = '^' + pkg.newVersion
    })
  })
}

// const flag = options.major ? 'major' : options.minor ? 'minor' : 'patch'

// args.forEach(name => bumpPkg(name, flag, options.only))

function getVersion (name: string) {
  return execSync(`npm show ${name} version`).toString().trim()
}

function update (name: string) {
  writeFileSync(
    resolve(__dirname, `../${name}/package.json`),
    JSON.stringify(packages[name], null, 2),
  )
}

// each((pkg, name) => {
//   if (!options.confirm) {
//     if (pkg.newVersion !== pkg.current.version) {
//       console.log(`- ${pkg.name}: \
// ${chalk.cyan(pkg.current.version)} => \
// ${chalk.blueBright(pkg.newVersion)}`)
//     }
//   } else if (pkg.newVersion !== pkg.previous.version) {
//     update(name)
//     const npmVersion = getVersion(pkg.name)
//     if (gte(npmVersion, pkg.newVersion)) return
//     console.log(` - ${pkg.name}: \
// ${chalk.green(npmVersion)} => \
// ${chalk.greenBright(pkg.newVersion)}`)
//   }
// })

const [shortName, newVersion] = args

if (!shortName || !newVersion) process.exit()

const pkgMap = {
  cli: 'koishi-cli',
  core: 'koishi-core',
  utils: 'koishi-utils',
  test: 'test-utils',
  level: 'database-level',
  mysql: 'database-mysql',
  common: 'plugin-common',
  teach: 'plugin-teach',
  monitor: 'plugin-monitor',
}

const name = pkgMap[shortName] || shortName
const { pkgName } = packages['packages/' + name]

each((pkg) => {
  const { dependencies, devDependencies } = pkg.current
  if (pkg.pkgName === pkgName) {
    pkg.newVersion = newVersion
  } else if (dependencies && pkgName in dependencies) {
    dependencies[pkgName] = '^' + newVersion
  } else if (devDependencies && pkgName in devDependencies) {
    devDependencies[pkgName] = '^' + newVersion
  } else return
  pkg.save()
})
