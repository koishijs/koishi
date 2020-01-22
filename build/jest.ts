import spawn from 'cross-spawn'

const args = ['jest', '--coverage']

if (process.argv[2]) {
  args.push(process.argv[2])
  if (process.argv[3]) {
    args.push('--collectCoverageFrom', `**/${process.argv[3]}/**.ts`)
  }
} else {
  args.push('packages/.+\\.spec\\.ts')
}

spawn('npx', args, { stdio: 'inherit' })
