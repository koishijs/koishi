import { writeJson } from 'fs-extra'
import { resolve } from 'path'
import { SemVer, gt, prerelease } from 'semver'
import { cyan, green } from 'kleur'
import { PackageJson, getWorkspaces } from './utils'
import latest from 'latest-version'
import cac from 'cac'
import ora from 'ora'

const { args, options } = cac()
  .option('-1, --major', '')
  .option('-2, --minor', '')
  .option('-3, --patch', '')
  .option('-p, --prerelease', '')
  .option('-a, --all', '')
  .option('-v, --version <ver>', '')
  .option('-l, --local', '')
  .option('-r, --recursive', '')
  .help()
  .parse()

const bumpTypes = ['major', 'minor', 'patch', 'prerelease', 'version'] as const
type BumpType = typeof bumpTypes[number]

class Package {
  name: string
  meta: PackageJson
  oldVersion: string
  metaVersion: string
  version: SemVer
  dirty: boolean

  static async from(path: string) {
    try {
      const pkg = packages[path] = new Package(path)
      pkg.metaVersion = pkg.meta.version
      pkg.oldVersion = pkg.meta.version
      if (pkg.meta.private || options.local) return
      pkg.oldVersion = prerelease(pkg.meta.version)
        ? await latest(pkg.name, { version: 'next' }).catch(() => latest(pkg.name))
        : await latest(pkg.name)
    } catch { /* pass */ }
  }

  constructor(public path: string) {
    this.meta = require(`../${path}/package.json`)
    this.name = this.meta.name
    this.version = new SemVer(this.meta.version)
  }

  bump(flag: BumpType) {
    if (this.meta.private) return
    let ver = new SemVer(this.oldVersion)
    if (!flag) {
      if (ver.prerelease.length) {
        const prerelease = ver.prerelease.slice() as [string, number]
        prerelease[1] += 1
        ver.prerelease = prerelease
      } else {
        ver.patch += 1
      }
    } else if (flag === 'version') {
      ver = new SemVer(options.version)
    } else if (flag === 'prerelease') {
      if (ver.prerelease.length) {
        ver.prerelease = [{
          alpha: 'beta',
          beta: 'rc',
        }[ver.prerelease[0]], 0]
      } else {
        ver = new SemVer(`${ver.major + 1}.0.0-alpha.0`)
      }
    } else {
      if (ver.prerelease.length) {
      ver.prerelease = []
      } else {
        ver[flag] += 1
        if (flag !== 'patch') ver.patch = 0
        if (flag === 'major') ver.minor = 0
      }
    }
    if (gt(ver.format(), this.version.format())) {
      this.dirty = true
      this.version = ver
      return this.meta.version = ver.format()
    }
  }

  save() {
    return writeJson(resolve(__dirname, `../${this.path}/package.json`), {
      ...this.meta,
      version: this.version.format(),
    }, { spaces: 2 })
  }
}

const packages: Record<string, Package> = {}

function getPackage(name: string) {
  return packages[`packages/${name}`]
    || packages[`plugins/${name}`]
    || packages[`plugins/adapter/${name}`]
    || packages[`plugins/assets/${name}`]
    || packages[`plugins/cache/${name}`]
    || packages[`plugins/database/${name}`]
    || packages[`plugins/frontend/${name}`]
    || packages[`plugins/${name}`]
    || packages[`community/adapter-${name}`]
    || packages[`community/assets-${name}`]
    || packages[`community/cache-${name}`]
    || packages[`community/database-${name}`]
    || packages[`community/${name}`]
}

function each<T>(callback: (pkg: Package, name: string) => T) {
  const results: T[] = []
  for (const path in packages) {
    results.push(callback(packages[path], packages[path].name))
  }
  return results
}

function bump(source: Package, flag: BumpType, recursive = false) {
  const newVersion = source.bump(flag)
  if (!newVersion) return
  const dependents = new Set<Package>()
  each((target) => {
    const { devDependencies, peerDependencies, dependencies, optionalDependencies } = target.meta
    const { name } = source
    if (target.name === name) return
    Object.entries({ devDependencies, peerDependencies, dependencies, optionalDependencies })
      .filter(([, dependencies = {}]) => dependencies[name])
      .forEach(([type]) => {
        target.meta[type][name] = '^' + newVersion
        target.dirty = true
        if (type !== 'devDependencies') {
          dependents.add(target)
        }
      })
  })
  if (!recursive) return
  dependents.forEach(dep => bump(dep, flag, recursive))
}

const flag = (() => {
  for (const type of bumpTypes) {
    if (type in options) return type
  }
})()

if (!args.length && !options.all) {
  console.log('no package specified')
  process.exit()
}

;(async () => {
  const folders = await getWorkspaces()
  folders.push('packages/create/template')

  const spinner = ora()
  let progress = 0
  spinner.start(`loading packages 0/${folders.length}`)
  await Promise.all(folders.map(async (path) => {
    await Package.from(path)
    spinner.text = `loading packages ${++progress}/${folders.length}`
  }))
  spinner.succeed()

  if (options.all) {
    bump(getPackage('utils'), flag, true)
  } else {
    args.forEach((name) => {
      const pkg = getPackage(name)
      if (!pkg) throw new Error(`${name} not found`)
      bump(pkg, flag, options.recursive)
    })
  }

  await Promise.all(each((pkg) => {
    if (!pkg.dirty) return
    if (pkg.metaVersion === pkg.meta.version) {
      console.log(`- ${pkg.name}: updated`)
    } else {
      console.log(`- ${pkg.name}: ${cyan(pkg.oldVersion)} => ${green(pkg.meta.version)}`)
    }
    return pkg.save()
  }))
})()
