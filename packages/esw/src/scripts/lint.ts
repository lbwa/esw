import path from 'path'
import type { ESLint, Linter } from 'eslint'
import fs from 'fs-extra'
import { CommandModule } from 'yargs'
import chalk from 'chalk'
import { ESLINT_DEFAULT_DIRS } from '../constants'
import { printAndExit } from '../utils'

type BuildScriptModule = CommandModule<
  { command?: string },
  { baseDir: string; dir?: string[] }
>

async function loadESLint(baseDir: string) {
  let eslint
  try {
    eslint = (await import(
      require.resolve('eslint', { paths: [baseDir] })
    )) as Promise<typeof import('eslint')>
  } catch (error) {
    throw new Error(
      `${chalk.red(
        'error'
      )} - Unable to find ESLint. Ensure ESLint is installed.`
    )
  }
  return eslint
}

function formatMessages(
  dir: string,
  messages: Linter.LintMessage[],
  filePath: string
) {
  let filename = path.posix.normalize(
    path.relative(dir, filePath).replace(/\\/g, '/')
  )

  if (!filename.startsWith('.')) filename = './' + filename

  let output = '\n' + chalk.cyan(filename)
  const warningCount = 0
  const errorCount = 0

  messages.forEach(msg => {
    const { message, line, column, ruleId } = msg

    output += '\n'

    if (line && column) {
      output =
        output +
        chalk.yellow(line.toString()) +
        ':' +
        chalk.yellow(column.toString()) +
        '  '
    }

    output += message
    if (ruleId) {
      output += '  ' + chalk.gray.bold(ruleId)
    }
  })

  return {
    output,
    warningCount,
    errorCount
  }
}

function formatLintResults(baseDir: string, results: ESLint.LintResult[]) {
  const formatted = results
    .filter(({ messages }) => messages?.length > 0)
    .map(({ messages, filePath }) => {
      const res = formatMessages(baseDir, messages, filePath)
      return res.output
    })
    .join('\n')

  return {
    output: formatted
  }
}

async function lint(
  baseDir: string,
  lintDirs: string | string[],
  eslintUserOptions: ESLint.Options = {}
) {
  const eslintLib = await loadESLint(baseDir)
  const { ESLint } = eslintLib
  const eslintOpts: ESLint.Options = {
    useEslintrc: true,
    baseConfig:
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('@lbwa/eslint-config-typescript') as ESLint.Options['baseConfig'],
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    ...eslintUserOptions
  }
  const eslint = new ESLint(eslintOpts)

  const lintStart = process.hrtime()

  const lintResults = await eslint.lintFiles(lintDirs)
  if (eslintOpts.fix) {
    await ESLint.outputFixes(lintResults)
  }
  const formattedResult = formatLintResults(baseDir, lintResults)

  const lintEnd = process.hrtime(lintStart)

  return {
    output: formattedResult.output,
    hasError: ESLint.getErrorResults(lintResults).length > 0,
    eventInfo: {
      durationInSeconds: lintEnd[0],
      lintedFilesCount: lintResults.length,
      lintFix: Boolean(eslintOpts.fix)
    }
  }
}

export const command: BuildScriptModule['command'] = ['lint [baseDir]']

export const describe: BuildScriptModule['describe'] = `Lint code`

export const builder = function builder(yargs) {
  return yargs
    .positional('baseDir', {
      type: 'string',
      desc: 'Working directory where we should work at',
      default: '.'
    })
    .option('fix', {
      type: 'boolean',
      desc: 'Automatically fix problems',
      default: false
    })
    .option('dir', {
      type: 'array',
      desc: 'Set directory, or directories, to run ESLint',
      default: ESLINT_DEFAULT_DIRS
    })
} as BuildScriptModule['builder']

export const handler: BuildScriptModule['handler'] = async function build(
  args
) {
  const { baseDir, dir } = args

  if (!fs.existsSync(baseDir)) {
    printAndExit(
      `${chalk.red(
        'error'
      )} - No such directory exists as the project root: ${chalk.red.bold(
        baseDir
      )}`
    )
  }

  const lintDirs = (dir ?? ESLINT_DEFAULT_DIRS).reduce((ans, dir) => {
    const dirPath = path.join(baseDir, dir)
    if (fs.existsSync(dirPath)) {
      ans.push(dirPath)
    }
    return ans
  }, [] as string[])

  const lintResults = await lint(baseDir, lintDirs)
  if (lintResults.hasError) {
    throw new Error(lintResults.output)
  }

  // eslint-disable-next-line no-console
  console.log(chalk.green(`✔ No ESLint warnings or errors`))
}
