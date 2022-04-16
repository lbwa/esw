/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/naming-convention */

import isString from 'lodash/isString'
import isNil from 'lodash/isNil'

export interface Handler<T = any> {
  (value: string | [string], name: string, previousValue?: T): T
}

type CliSpecKey = `-${string}` | `--${string}`

type CliSpecValue<T = any> = string | Handler<T> | [Handler<T>]

export interface CliSpec<T = any> {
  [key: CliSpecKey]: CliSpecValue<T>
}

export type Result<T extends CliSpec> = { _: string[] } & {
  [K in keyof T]?: T[K] extends Handler
    ? ReturnType<T[K]>
    : T[K] extends [Handler]
    ? ReturnType<T[K][number]>[]
    : never
}

type ResultKeys<T extends CliSpec> = keyof Result<T>

function isCliSpecKey(key: unknown): key is CliSpecKey {
  return isString(key) && key.startsWith('-')
}

function separateCliArgs(arg: string): `-${string}`[] {
  if (!arg.startsWith('-')) {
    return []
  }
  if (arg.startsWith('--') || arg.length === 2) {
    return [arg as `-${string}`]
  }
  // '-rf' -> ['-r', '-f']
  return arg
    .slice(1)
    .split('')
    .map(ch => `-${ch}` as const)
}

function separateCliArgKeyValue(
  arg: string
): [CliSpecKey, string | [string] | undefined] {
  if (arg.startsWith('--') && arg.includes(':')) {
    const [name, value] = arg.split(/:(.*)/, 2) as [CliSpecKey, string]
    if (value?.includes('=')) {
      return [name, value]
    }
    return [name, [value]]
  }
  return arg.startsWith('--')
    ? (arg.split(/=(.*)/, 2) as [CliSpecKey, string])
    : [arg as CliSpecKey, undefined]
}

// parse unknown cli arguments which starts with --
const defaultHandler: Handler<any> = (value, _, prev) => {
  /* --inject:./index.ts --pure:console.log */
  if (Array.isArray(value)) {
    return [...(prev ?? []), ...value]
  }
  /* --loader:.mjs=js --loader:.cjs=js */
  if (value.includes('=')) {
    const [key, val] = value.split(/=(.*)/, 2)
    return { ...prev, [key as string]: val }
  }
  return value
}

class CliParser {
  constructor(private argv = process.argv.slice(2)) {}

  validateSpec<Spec extends CliSpec>(spec: Spec) {
    const keys = Object.keys(spec)
    if (keys.some(key => !key.startsWith('-'))) {
      throw new Error(`argument key must start with '-'`)
    }
    return true
  }

  parse<Spec extends CliSpec>(spec: Spec): Result<Spec> {
    this.validateSpec(spec)
    const parsedResult: Result<Spec> = {
      _: [] as string[]
    } as Result<Spec>
    const aliasMap = new Map<CliSpecKey, CliSpecKey>()
    const handlerMap = new Map<CliSpecKey, [CliSpecValue, boolean]>()
    ;(
      Object.entries(spec) as ReadonlyArray<[keyof CliSpec, CliSpecValue]>
    ).forEach(([name, value]) => {
      if (isCliSpecKey(value)) {
        aliasMap.set(name, value)
        return
      }

      handlerMap.set(name, [value, value === Boolean])
    })
    this.argv.forEach((wholeArg, i) => {
      if (wholeArg.length < 2 || !wholeArg.startsWith('-')) {
        parsedResult._.push(wholeArg)
        return
      }

      const separatedArguments = separateCliArgs(wholeArg)

      separatedArguments.forEach((arg, j) => {
        const [argName, argValue] = separateCliArgKeyValue(arg)
        const aliasedArgName = aliasMap.get(argName) ?? argName

        const [typeHandler, isCliFlag] = handlerMap.get(aliasedArgName) ?? [
          defaultHandler,
          isNil(argValue)
        ]

        if (!isCliFlag && j + 1 < separatedArguments.length) {
          throw new Error(
            `option requires argument (but was followed by another short argument): ${argName}`
          )
        }

        if (isCliFlag /* eg. --enable */) {
          parsedResult[aliasedArgName as keyof typeof parsedResult] = (
            typeHandler as Handler
          )(
            'true',
            aliasedArgName,
            parsedResult[aliasedArgName as ResultKeys<Spec>]
          )
          return
        }

        if (isNil(argValue)) {
          const { argv } = this
          if (
            argv.length < i + 2 ||
            ((argv[i + 1]?.length ?? 0) > 1 &&
              argv[i + 1]?.startsWith('-') &&
              !(
                argv[i + 1]?.match(/^-?\d*(\.(?=\d))?\d*$/) &&
                (typeHandler === Number ||
                  (typeof BigInt !== 'undefined' && typeHandler === BigInt))
              ))
          ) {
            const extended =
              argName === aliasedArgName
                ? ''
                : ` (alias for ${aliasedArgName as string})`
            throw new Error(`option requires argument: ${argName}${extended}`)
          }

          parsedResult[aliasedArgName as keyof typeof parsedResult] = (
            typeHandler as Handler
          )(
            argv[i + 1] ?? '',
            aliasedArgName,
            parsedResult[aliasedArgName as ResultKeys<Spec>]
          )
          return
        }

        /* eg. --name=bar, --loader:.mjs=js --pure:console.log */
        parsedResult[aliasedArgName as keyof typeof parsedResult] = (
          typeHandler as Handler
        )(
          argValue,
          aliasedArgName,
          parsedResult[aliasedArgName as ResultKeys<Spec>]
        )
      })
    })

    return parsedResult
  }
}

export function createCliParser(
  ...args: ConstructorParameters<typeof CliParser>
) {
  return new CliParser(...args)
}
