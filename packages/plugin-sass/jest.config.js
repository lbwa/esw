const { pathsToModuleNameMapper } = require('ts-jest')

const config = require('../../jest.config')

const tsConfig = require('./tsconfig.json')

module.exports = {
  ...config,
  rootDir: tsConfig.baseUrl || __dirname,
  moduleNameMapper: pathsToModuleNameMapper(
    tsConfig.compilerOptions.paths || {},
    { prefix: '<rootDir>/' }
  )
}
