import yargs from 'yargs/yargs'
import fs from 'fs-extra'

/**
 * A factory that returns a yargs() instance
 */
export default function cli(cwd?: string) {
  const parser = yargs(void 0, cwd)

  parser.commandDir('./scripts')

  return parser
    .scriptName('tsrc')
    .help()
    .version()
    .strictCommands(true)
    .usage('$0 <command> [options]')
    .recommendCommands()

    .alias('h', 'help')
    .alias('v', 'version')

    .config('config', configPath => {
      const isExist = fs.existsSync(configPath)
      if (!isExist) throw new Error(`Invalid config file path: ${configPath}`)
      return fs.readJsonSync(configPath) as Record<string, unknown>
    })
}
