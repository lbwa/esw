// @ts-check

const { pathsToModuleNameMapper } = require('ts-jest')
const config = require('../../jest.config')
const tsConfig = require('./tsconfig.json')

/** @type {import('@jest/types').Config.InitialOptionsWithRootDir} */
module.exports = {
  ...config,
  rootDir: tsConfig.compilerOptions.baseUrl || __dirname,
  moduleNameMapper: pathsToModuleNameMapper(
    tsConfig.compilerOptions.paths || {},
    { prefix: '<rootDir>/' }
  ),
  testEnvironment: '<rootDir>/test/e2e/jest.environment.js',
  setupFilesAfterEnv: ['<rootDir>/test/e2e/jest.setup.ts']
}
