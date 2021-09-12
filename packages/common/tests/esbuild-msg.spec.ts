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
})
