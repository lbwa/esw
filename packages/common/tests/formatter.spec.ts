import { serializeSize } from '../src'

describe('formatter', () => {
  it('serializeSize', () => {
    expect(serializeSize(12)).toContain('12 B')
    expect(serializeSize(1200)).toContain('1.2 kB')
    expect(serializeSize(12 * 1e3)).toContain('12 kB')
    expect(serializeSize(12 * 1e4)).toContain('120 kB')
    expect(serializeSize(12 * 1e5)).toContain('1.2 MB')
  })
})
