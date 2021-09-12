import { printBuildError } from '../src'

describe('serialize build error', () => {
  it('should print build error', async () => {
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    const wrongSpy = jest.spyOn(process.stdout, 'write')
    printBuildError({
      errors: [
        {
          detail: undefined,
          location: {
            column: 20,
            file: 'index.ts',
            length: 11,
            line: 3,
            lineText: "import { fib } from './src/fib'",
            namespace: '',
            suggestion: ''
          },
          notes: [],
          pluginName: '',
          text: 'Could not resolve "./src/fib"'
        }
      ],
      warnings: [],
      name: 'Error',
      message: 'Could not resolve "./src/fib"'
    })
    expect(wrongSpy).not.toHaveBeenCalled()
    expect(spy).toBeCalledTimes(1)
    expect(spy.mock.calls[0]?.join('\n')).toMatchSnapshot(`stderr`)

    spy.mockRestore()
    wrongSpy.mockRestore()
  })

  it('should print build error with plugin name', async () => {
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    const wrongSpy = jest.spyOn(process.stdout, 'write')
    printBuildError({
      errors: [
        {
          detail: undefined,
          location: {
            column: 20,
            file: 'index.ts',
            length: 11,
            line: 3,
            lineText: "import { fib } from './src/fib'",
            namespace: '',
            suggestion: ''
          },
          notes: [],
          pluginName: 'mock plugin name',
          text: 'Could not resolve "./src/fib"'
        }
      ],
      warnings: [],
      name: 'Error',
      message: 'Could not resolve "./src/fib"'
    })
    expect(wrongSpy).not.toHaveBeenCalled()
    expect(spy).toBeCalledTimes(1)
    expect(spy.mock.calls[0]?.join('\n')).toMatchSnapshot(`stderr`)

    spy.mockRestore()
    wrongSpy.mockRestore()
  })

  it('should print note', async () => {
    const spy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    const wrongSpy = jest.spyOn(process.stdout, 'write')

    printBuildError({
      errors: [
        {
          detail: undefined,
          location: {
            column: 58,
            file: 'index.tsx',
            length: 1,
            line: 1,
            lineText:
              'let button = <Button content="some so-called \\"button text\\"" />',
            namespace: '',
            suggestion: ''
          },
          notes: [
            {
              location: {
                column: 45,
                file: 'index.tsx',
                length: 2,
                line: 1,
                lineText:
                  'let button = <Button content="some so-called \\"button text\\"" />',
                namespace: '',
                suggestion: '&quot;'
              },
              text: 'Quoted JSX attributes use XML-style escapes instead of JavaScript-style escapes'
            },
            {
              location: {
                column: 29,
                file: 'index.tsx',
                length: 32,
                line: 1,
                lineText:
                  'let button = <Button content="some so-called \\"button text\\"" />',
                namespace: '',
                suggestion: '{"some so-called \\"button text\\""}'
              },
              text: 'Consider using a JavaScript string inside {...} instead of a quoted JSX attribute'
            }
          ],
          pluginName: '',
          text: 'Unexpected backslash in JSX element'
        }
      ],
      warnings: [],
      name: 'Error',
      message: ''
    })

    expect(wrongSpy).not.toHaveBeenCalled()
    expect(spy).toBeCalledTimes(1)
    expect(spy.mock.calls[0]?.join('\n')).toMatchSnapshot(`stderr`)
    spy.mockRestore()
  })
})
