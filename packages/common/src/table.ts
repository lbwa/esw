import chalk from './chalk'

const COL_SEPARATOR = '  '
const ANSI_REG_PATTERN = [
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
].join('|')
const ANSI_REG = new RegExp(ANSI_REG_PATTERN, 'g')

export enum Align {
  LEFT = 'left',
  RIGHT = 'right',
  CENTER = 'center'
}

export function stripAnsiCodes(str: string) {
  return `${str}`.replace(ANSI_REG, '')
}

function stripedLength(str: string) {
  return stripAnsiCodes(str).length
}

export function createTable<Data extends string | number>(
  matrix: Data[][],
  align: Align = Align.LEFT
) {
  const stringifyMatrix = matrix.map(row => row.map(item => `${item}`))

  const colWidths = stringifyMatrix.reduce((widths, row) => {
    row.forEach((char, colIndex) => {
      const length = stripedLength(char)
      if (!widths[colIndex] || length > (widths[colIndex] as number))
        widths[colIndex] = length
    })
    return widths
  }, [] as number[])

  return stringifyMatrix
    .map(row =>
      row
        .map((char, index) => {
          const length = (colWidths[index] ?? 0) - stripedLength(char) ?? 0
          const space = Array(Math.max(length + 1, 1)).join(' ')
          if (align === Align.RIGHT) {
            return space + char
          }
          if (align === Align.CENTER) {
            return (
              new Array(Math.ceil(length / 2 + 1)).join(' ') +
              char +
              new Array(((length >> 1) + 1) | 0).join(' ')
            )
          }

          return char + space
        })
        .join(COL_SEPARATOR)
        .replace(/\s+$/, '')
    )
    .join('\n')
}

export function printTable<Data extends string | number>(
  matrix: Data[][],
  align: Align = Align.LEFT
) {
  if (matrix.length > 1) {
    const [heads = []] = matrix
    matrix[0] = heads.map(head => chalk.underline(head)) as Data[]
  }
  process.stdout.write(['\n', createTable(matrix, align), '\n'].join(''))
}
