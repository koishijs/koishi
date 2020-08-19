import { writeJson } from 'fs-extra'
import { resolve } from 'path'
import { SemVer, gt, prerelease } from 'semver'
import { cyan, green } from 'kleur'
import { PackageJson, getWorkspaces } from './utils'
import latest from 'latest-version'
import CAC from 'cac'
import ora from 'ora'

const { args, options } = CAC()
  .option('-1, --major', '')
  .option('-2, --minor', '')
  .option('-3, --patch', '')
  .option('-o, --only', '')
  .help()
  .parse()

type BumpType = 'major' | 'minor' | 'patch' | 'auto'

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
      if (pkg.meta.private) return
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
    const newVersion = new SemVer(this.oldVersion)
    if (flag === 'auto') {
      if (newVersion.prerelease.length) {
        const prerelease = newVersion.prerelease.slice() as [string, number]
        prerelease[1] += 1
        newVersion.prerelease = prerelease
      } else {
        newVersion.patch += 1
      }
    } else {
      if (newVersion.prerelease.length) {
        newVersion.prerelease = []
      } else {
        newVersion[flag] += 1
        if (flag !== 'patch') newVersion.patch = 0
        if (flag === 'major') newVersion.minor = 0
      }
    }
    if (gt(newVersion.format(), this.version.format())) {
      this.dirty = true
      this.version = newVersion
      return this.meta.version = newVersion.format()
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

const nameMap = {
  test: 'test-utils',
}

function getPackage(name: string) {
  name = nameMap[name] || name
  return packages[`packages/${name}`]
    || packages[`packages/koishi-${name}`]
    || packages[`packages/adapter-${name}`]
    || packages[`packages/plugin-${name}`]
}

function each<T>(callback: (pkg: Package, name: string) => T) {
  const results: T[] = []
  for (const path in packages) {
    results.push(callback(packages[path], packages[path].name))
  }
  return results
}

function bumpPkg(source: Package, flag: BumpType, only = false) {
  const newVersion = source.bump(flag)
  if (!newVersion) return
  const dependents = new Set<Package>()
  each((target) => {
    const { devDependencies, peerDependencies, dependencies, optionalDependencies } = target.meta
    const { name } = source
    if (target.name === name) return
    Object.entries({ devDependencies, peerDependencies, dependencies, optionalDependencies })
      .filter(([_, dependencies = {}]) => dependencies[name])
      .forEach(([type]) => {
        target.meta[type][name] = '^' + newVersion
        target.dirty = true
        if (type !== 'devDependencies') {
          dependents.add(target)
        }
      })
  })
  if (only) return
  dependents.forEach(dep => bumpPkg(dep, flag))
}

const flag = options.major ? 'major' : options.minor ? 'minor' : options.patch ? 'patch' : 'auto'

;(async () => {
  const folders = await getWorkspaces()
  const spinner = ora()
  let progress = 0
  spinner.start(`loading packages 0/${folders.length}`)
  await Promise.all(folders.map(async (path) => {
    await Package.from(path)
    spinner.text = `loading packages ${++progress}/${folders.length}`
  }))
  spinner.succeed()

  args.forEach((name) => {
    const pkg = getPackage(name)
    if (!pkg) throw new Error(`${name} not found`)
    bumpPkg(pkg, flag, options.only)
  })

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
