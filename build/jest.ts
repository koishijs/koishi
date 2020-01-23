import spawn from 'cross-spawn'
import open from 'open'
import { resolve } from 'path'

const args = ['jest', '--coverage']

if (process.argv[2]) {
  args.push(process.argv[2])
  if (process.argv[3]) {
    args.push('--collectCoverageFrom', `**/${process.argv[3]}/**/*.ts`)
  }
} else {
  args.push('packages/.+\\.spec\\.ts')
}

const child = spawn('npx', args, { stdio: 'inherit' })

child.on('close', () => {
  open(resolve(__dirname, '../coverage/lcov-report/index.html'))
})
