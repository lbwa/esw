import { printTable, stripAnsiCodes, Align } from '../src'

describe('table', () => {
  it('should print a table with default alignment', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const table = [
      ['head0', `head1`, `head2`],
      [`1`, `22`, `333`]
    ]
    printTable(table)
    expect(spy).toBeCalledTimes(1)
    expect(stripAnsiCodes(spy.mock.calls[0]?.join('') ?? '')).toMatchSnapshot(
      'table with default alignment'
    )
    spy.mockRestore()
  })

  it('should print a table with right alignment', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const table = [
      ['head0', `head1`, `head2`],
      [`1`, `22`, `333`]
    ]
    printTable(table, Align.RIGHT)
    expect(spy).toBeCalledTimes(1)
    expect(stripAnsiCodes(spy.mock.calls[0]?.join('') ?? '')).toMatchSnapshot(
      'table with right alignment'
    )
    spy.mockRestore()
  })

  it('should print a table with center alignment', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const table = [
      ['head0', `head1`, `head2`],
      [`1`, `22`, `333`]
    ]
    printTable(table, Align.CENTER)
    expect(spy).toBeCalledTimes(1)
    expect(stripAnsiCodes(spy.mock.calls[0]?.join('') ?? '')).toMatchSnapshot(
      'table with center alignment'
    )
    spy.mockRestore()
  })
})
