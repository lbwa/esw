import path from 'path'
import fs from 'fs'
import { packLocalPackage } from './sandbox/package'

beforeAll(async () => {
  if (process.env.E2E_LIB_PACK_PATH) {
    throw new Error('"process.env.EP_CHECKER_PACK_PATH" has been defined.')
  }
  process.env.E2E_LIB_PACK_PATH = await packLocalPackage(
    path.resolve(__dirname, '../../')
  )
})

afterAll(async () => {
  if (process.env.E2E_LIB_PACK_PATH) {
    await fs.promises.rm(process.env.E2E_LIB_PACK_PATH, {
      force: true,
      maxRetries: 3
    })
  }
})

jest.retryTimes(0)
jest.setTimeout(20e3)
