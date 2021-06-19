import path from 'path'
import { CommandModule } from 'yargs'
import fs from 'fs-extra'

type BuildScriptModule = CommandModule<{ command?: string }, ScriptInitConfig>

export type ScriptInitConfig = {
  workingDirectory: string
}

const CWD = process.cwd()

export const command: BuildScriptModule['command'] = ['init [workingDirectory]']

export const describe: BuildScriptModule['describe'] = `Init a project`

export const builder = function builder(yargs) {
  return yargs.positional('workingDirectory', {
    describe: 'The root path of project',
    type: 'string',
    default: '.'
  })
} as BuildScriptModule['builder']

export const handler: BuildScriptModule['handler'] = async function init({
  workingDirectory
}) {
  const createOutputPath = (filename: string) =>
    path.join(CWD, workingDirectory, filename)

  await fs.outputJSON(
    createOutputPath('package.json'),
    {
      name: 'root',
      private: true,
      dependencies: {},
      devDependencies: {
        '@lbwa/tsconfig': '*',
        '@lbwa/pretter-config': '*',
        eslint: '^7.29.0',
        husky: '^6.0.0',
        'lint-staged': '^11.0.0',
        prettier: '^2.3.0'
      }
    },
    { spaces: 2 }
  )

  await fs.outputJSON(
    createOutputPath('tsconfig.json'),
    {
      $schema: 'https://json.schemastore.org/tsconfig',
      extends: '@lbwa/tsconfig'
    },
    { spaces: 2 }
  )

  await fs.outputFile(
    createOutputPath('.prettierrc.js'),
    `module.exports = {
  ...require("@lbwa/pretter-config"),
  // set extra prettier options from here if necessary
}`
  )
}
