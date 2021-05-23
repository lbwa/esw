import yargs from 'yargs/yargs'
import { ScriptBuildConfigs } from './scripts/build'

export type TranspileModuleType = 'cjs' | 'esm'

/**
 * A factory that returns a yargs() instance
 */
export default function cli(cwd?: string) {
  const parser = yargs(void 0, cwd)

  return parser
    .scriptName('tsrc')
    .help()
    .version()
    .strict(true)
    .usage('$0 <command> [options]')
    .recommendCommands()

    .alias('h', 'help')
    .alias('v', 'version')

    .command('help [command]', 'show command manual', yargs =>
      yargs.positional('command', {
        describe: 'target command',
        type: 'string'
      })
    )

    .command(
      'build [entry]',
      'transpile typescript codebase',
      yargs =>
        yargs
          .positional('entry', {
            describe: 'Specify transpile entrypoint',
            type: 'string',
            default: 'src'
          })
          .option('module', {
            type: 'string',
            default: 'esm',
            describe: 'Specify module code generation'
          })
          .option('outDir', {
            type: 'string',
            default: 'dist',
            describe: 'Redirect output structure to the directory'
          }),
      async argv => {
        const { build } = await import('./scripts/build')
        await build(argv as ScriptBuildConfigs)
      }
    )
}
