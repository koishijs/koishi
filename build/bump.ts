import { writeJson } from 'fs-extra'
import { resolve } from 'path'
import { exec } from './utils'
import { SemVer, gt } from 'semver'
import { cyan, green } from 'kleur'
import globby from 'globby'
import CAC from 'cac'

const { args, options } = CAC()
  .option('-1, --major', '')
  .option('-2, --minor', '')
  .option('-3, --patch', '')
  .option('-o, --only', '')
  .parse()

type BumpType = 'major' | 'minor' | 'patch'

interface PackageJSON {
  name: string
  private?: boolean
  version: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

class Package {
  name: string
  meta: PackageJSON
  oldVersion: string
  version: SemVer
  dirty: boolean

  static async from (path: string) {
    try {
      const pkg = packages[path] = new Package(path)
      pkg.oldVersion = pkg.meta.version
      if (pkg.meta.private) return
      const version = await exec(`npm view ${pkg.name} version`, {
        cwd: resolve(__dirname, `../${path}`),
        silent: true,
      })
      pkg.oldVersion = version.trim()
    } catch { /* pass */ }
  }

  constructor (public path: string) {
    this.meta = require(`../${path}/package.json`)
    this.name = this.meta.name
    this.version = new SemVer(this.meta.version)
  }

  bump (flag: BumpType) {
    if (this.meta.private) return
    const newVersion = new SemVer(this.oldVersion)
    if (flag === 'patch' && newVersion.prerelease.length) {
      const prerelease = newVersion.prerelease.slice() as [string, number]
      prerelease[1] += 1
      newVersion.prerelease = prerelease
    } else {
      newVersion[flag] += 1
      newVersion.prerelease = []
      if (flag !== 'patch') newVersion.patch = 0
      if (flag === 'major') newVersion.minor = 0
    }
    if (gt(newVersion, this.version)) {
      this.dirty = true
      this.version = newVersion
      return this.meta.version = newVersion.format()
    }
  }

  save () {
    return writeJson(resolve(__dirname, `../${this.path}/package.json`), {
      ...this.meta,
      version: this.version.format(),
    }, { spaces: 2 })
  }
}

const packages: Record<string, Package> = {}

const nameMap = {
  test: 'test-utils',
}

function getPackage (name: string) {
  name = nameMap[name] || name
  return packages[`packages/${name}`]
    || packages[`packages/koishi-${name}`]
    || packages[`packages/database-${name}`]
    || packages[`packages/plugin-${name}`]
}

function each <T> (callback: (pkg: Package, name: string) => T) {
  const results: T[] = []
  for (const path in packages) {
    results.push(callback(packages[path], packages[path].name))
  }
  return results
}

function bumpPkg (source: Package, flag: BumpType, stop = false) {
  if (!source) return
  const newVersion = source.bump(flag)
  if (!newVersion) return
  const dependents = new Set<Package>()
  each((target) => {
    const { meta } = target
    if (target.name === source.name) return
    Object.keys(meta.devDependencies || {}).forEach((name) => {
      if (name !== source.name) return
      meta.devDependencies[name] = '^' + newVersion
      dependents.add(target)
    })
    Object.keys(meta.dependencies || {}).forEach((name) => {
      if (name !== source.name) return
      meta.dependencies[name] = '^' + newVersion
      dependents.add(target)
    })
  })
  if (stop) return
  dependents.forEach(dep => bumpPkg(dep, flag))
}

const flag: BumpType = options.major ? 'major' : options.minor ? 'minor' : 'patch'

;(async () => {
  const folders = await globby(require('../package').workspaces, {
    deep: 0,
    onlyDirectories: true,
  })

  await Promise.all(folders.map(path => Package.from(path)))

  args.forEach(name => bumpPkg(getPackage(name), flag, options.only))

  await Promise.all(each((pkg) => {
    if (!pkg.dirty) return
    console.log(`- ${pkg.name}: ${cyan(pkg.oldVersion)} => ${green(pkg.meta.version)}`)
    return pkg.save()
  }))
})()
