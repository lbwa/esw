import isNil from 'lodash/isNil'
import { BuildFailure, Message, Note } from 'esbuild'
import { colors } from '../stdout'
import { isDef } from '..'

const enum MsgKind {
  ERROR = 1,
  NOTE
}

const KIND_COLORS = new Map([
  [MsgKind.ERROR, colors.bgRed.black],
  [MsgKind.NOTE, colors.bgYellow.black]
])

const KIND_LABELS = new Map([
  [MsgKind.ERROR, 'error'],
  [MsgKind.NOTE, 'note']
])

function renderTabStops(withTabs: string, spacesPerTab: number): string {
  if (!withTabs.includes('\t')) {
    return withTabs
  }

  let withoutTabs = '',
    count = 0

  for (let i = 0; i < withTabs.length; i++) {
    const char = withTabs[i]
    if (char === '\t') {
      const spaces = spacesPerTab - (count % spacesPerTab)
      for (let j = 0; j < spaces; j++) {
        withoutTabs += ' '
        count++
      }
    } else {
      withoutTabs += char
      count++
    }
  }

  return withoutTabs
}

function estimateSpacesPerTab(text: string): number {
  return decodeURIComponent(text).length
}

function marginWithLineText(maxMargin: number, lineValue: number) {
  const line = lineValue.toString()
  return `    ${' '.repeat(maxMargin - line.length)}${line} │ `
}

function emptyMarginText(maxMargin: number, isLast: boolean): string {
  const space = ' '.repeat(maxMargin)
  if (isLast) {
    return `    ${space} ╵ `
  }
  return `    ${space} │ `
}

function serializeMessage<Data extends Note>(message: Data, maxMargin: number) {
  const { location: loc } = message

  if (isNil(loc)) return

  let endOfFirstLine = loc.lineText.length
  for (let i = 0; i < loc.lineText.length; i++) {
    const char = loc.lineText[i]
    if (
      // new line, line feed
      char === '\n' ||
      // carriage return
      char === '\r' ||
      // line separator
      char === '\u2028' ||
      // paragraph separator
      char === '\u2029'
    ) {
      endOfFirstLine = i
      break
    }
  }

  // only highlight the first line of the line text
  const firstLine = loc.lineText.slice(0, endOfFirstLine)
  const afterFirstLine = loc.lineText.slice(endOfFirstLine)

  // clamp values in range
  loc.line = Math.max(loc.line, 0)
  loc.column = Math.max(loc.column, 0)
  loc.length = Math.max(loc.length, 0)
  loc.column = Math.min(loc.column, endOfFirstLine)
  loc.length = Math.min(loc.length, endOfFirstLine - loc.column)

  const spacesPerTab = 2
  const lineText = renderTabStops(firstLine, spacesPerTab)
  const textUpToLoc = renderTabStops(
    firstLine.slice(0, loc.column),
    spacesPerTab
  )
  let markerStart = textUpToLoc.length
  let markerEnd = markerStart
  const indent = ' '.repeat(estimateSpacesPerTab(textUpToLoc))
  let marker = '^'

  // extend markers to cover the full range of the error
  if (loc.length > 0) {
    markerEnd = renderTabStops(
      firstLine.slice(0, loc.column + loc.length),
      spacesPerTab
    ).length
  }

  // clip the marker to the bounds of the line
  markerStart = Math.min(markerStart, lineText.length)
  markerEnd = Math.min(markerEnd, lineText.length)
  markerEnd = Math.max(markerEnd, markerStart)

  if (markerEnd - markerStart > 1) {
    marker = '~'.repeat(
      estimateSpacesPerTab(lineText.slice(markerStart, markerEnd))
    )
  }

  // put a margin before the marker indent
  const margin = marginWithLineText(maxMargin, loc.line)

  return {
    path: loc.file,
    line: loc.line,
    column: loc.column,
    message: message.text,

    sourceBefore: margin + lineText.slice(0, markerStart),
    sourceMarked: lineText.slice(markerStart, markerEnd),
    sourceAfter: lineText.slice(markerEnd),

    indent,
    marker,
    suggestion: loc.suggestion,

    contentAfter: afterFirstLine
  }
}

function estimateMaxMargin(message: Message) {
  let maxMargin = 0
  if (isDef(message.location)) {
    maxMargin = message.location.line.toString().length
  }
  message.notes?.forEach(note => {
    if (note.location && note.location.line) {
      maxMargin = Math.max(maxMargin, note.location.line.toString().length)
    }
  })
  return maxMargin
}

function prettyMessage<Data extends Note>(
  kind: MsgKind,
  message: Data,
  maxMargin: number,
  pluginName: string
) {
  const pluginText = pluginName ? colors.yellow(`[plugin: ${pluginName}] `) : ''
  const kindColor = KIND_COLORS.get(kind) ?? colors.bgWhite.black
  const kindLabel = KIND_LABELS.get(kind) ?? ''
  const kindString = kindColor(` ${kindLabel.toUpperCase()} `)
  const msgColor = colors.bold

  if (isNil(message.location)) {
    process.stderr.write(`\n${pluginText} ${msgColor(message.text)}\n\n`)
    return ''
  }

  const { location: loc } = message

  if (isNil(loc)) return `${kindString} ${pluginText} ${message.text}`

  const details = serializeMessage(message, maxMargin)
  if (isNil(details)) return ''

  const hasSuggestion = !!details.suggestion
  const callout = hasSuggestion ? details.suggestion : details.marker
  const calloutPrefix = hasSuggestion
    ? `${emptyMarginText(maxMargin, false)}${details.indent}${colors.green(
        details.marker
      )}\n`
    : ``

  return [
    `${kindString} ${details.path}:${details.line}:${
      details.column
    } ${pluginText}${msgColor(details.message)}`,
    `${details.sourceBefore}${colors.green(details.sourceMarked)}${colors.dim(
      details.sourceAfter
    )}`,
    `${calloutPrefix}${emptyMarginText(maxMargin, true)}${
      details.indent
    }${colors.green(callout)}${colors.dim(details.contentAfter)}`,
    `\n`
  ].join('\n')
}

export function printBuildError(failure: BuildFailure) {
  const { errors } = failure
  const [error] = errors // only print first error
  if (isNil(error)) return

  const maxMargin = estimateMaxMargin(error)
  let text = prettyMessage(MsgKind.ERROR, error, maxMargin, error.pluginName)
  const gap =
    error.location && error.location.lineText.includes('\n') ? '\n' : ''

  error.notes?.forEach(note => {
    text += gap
    text += prettyMessage(MsgKind.NOTE, note, maxMargin, error.pluginName)
  })

  process.stderr.write(text)
}
