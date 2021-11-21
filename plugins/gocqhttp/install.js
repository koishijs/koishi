const { downloadRelease, getReleaseByTag } = require('./lib/install')

async function install() {
  const release = await getReleaseByTag('v1.0.0-beta8-fix1')
  await downloadRelease(release)
}

if (__dirname.includes('node_modules')) {
  install()
}
