import {
  IS_ENV_DEV,
  IS_ENV_PROD,
  IS_ENV_TEST,
  IS_PLATFORM_WINDOWS
} from '../src'

describe('constants', () => {
  it("shouldn't be undefined", () => {
    expect(IS_ENV_DEV).not.toBeUndefined()
    expect(IS_ENV_PROD).not.toBeUndefined()
    expect(IS_ENV_TEST).not.toBeUndefined()
    expect(IS_PLATFORM_WINDOWS).not.toBeUndefined()
  })
})
