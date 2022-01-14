import { assert, invariant } from '../src'

describe('assertion', () => {
  it('assert', () => {
    expect(() => {
      assert(true, 'assert message')
    }).not.toThrowError()

    expect(() => {
      assert(false, 'error message if condition is falsy')
    }).toThrowErrorMatchingSnapshot('falsy assertion')
  })

  it('invariant', () => {
    expect(() => {
      invariant(true, 'assert message')
    }).not.toThrowError()

    expect(() => {
      invariant(false, 'error message if condition is falsy')
    }).not.toThrowError()

    process.env.NODE_ENV = 'development'
    expect(() => {
      invariant(true, 'assert message')
    }).not.toThrowError()

    expect(() => {
      invariant(false, 'error message if condition is falsy')
    }).toThrowErrorMatchingSnapshot('invariant with falsy ')
    process.env.NODE_ENV = 'test'
  })
})
