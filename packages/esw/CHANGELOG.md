# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.11.1](https://github.com/lbwa/esw/compare/esw@0.11.0...esw@0.11.1) (2022-01-11)

### Bug Fixes

- **esw:** should occur build again when children files changed ([24bc6b3](https://github.com/lbwa/esw/commit/24bc6b32ef98afdc3d5484e4a446bbc0a2d6942f))

# [0.11.0](https://github.com/lbwa/esw/compare/esw@0.10.3...esw@0.11.0) (2022-01-11)

### Bug Fixes

- **esw:** should occur all builds in watch mode ([#31](https://github.com/lbwa/esw/issues/31)) ([0ad8edd](https://github.com/lbwa/esw/commit/0ad8eddf88ffb5e495d0fc11a22fc0bac9fc7b2f))

### Features

- **esw:** use esbuild io ([#32](https://github.com/lbwa/esw/issues/32)) ([9e7a711](https://github.com/lbwa/esw/commit/9e7a711ff93ecae4bb229a640744e0b14ccb4cb9))

## [0.10.3](https://github.com/lbwa/esw/compare/esw@0.10.2...esw@0.10.3) (2022-01-09)

### Bug Fixes

- **esw:** exclude .vscode .husky watching ([dd6335a](https://github.com/lbwa/esw/commit/dd6335a9d6f0997b754dba999924ed6bf6e486c4))

## [0.10.2](https://github.com/lbwa/esw/compare/esw@0.10.2-alpha.0...esw@0.10.2) (2022-01-08)

### Bug Fixes

- **esw:** resume inferBuildOption Observable ([#28](https://github.com/lbwa/esw/issues/28)) ([76172ef](https://github.com/lbwa/esw/commit/76172ef75cc3dc73bf4a3954989cafb9de9b8564))

## [0.10.2-alpha.0](https://github.com/lbwa/esw/compare/esw@0.10.1...esw@0.10.2-alpha.0) (2022-01-08)

**Note:** Version bump only for package esw

## [0.10.1](https://github.com/lbwa/esw/compare/esw@0.10.0...esw@0.10.1) (2022-01-08)

**Note:** Version bump only for package esw

# [0.10.0](https://github.com/lbwa/esw/compare/esw@0.10.0-alpha.0...esw@0.10.0) (2021-09-26)

### Features

- **esw:** serialize watch result error ([6a50b3d](https://github.com/lbwa/esw/commit/6a50b3d98040d404cfa89c5e62114a061bacc257))

# [0.10.0-alpha.0](https://github.com/lbwa/esw/compare/esw@0.9.0...esw@0.10.0-alpha.0) (2021-09-25)

### Features

- **esw:** ensure first emit when file watcher setup ([d8e1add](https://github.com/lbwa/esw/commit/d8e1add9236c76f010f68af262c4504ec09b5cba))
- **esw:** info printer in the watch mode ([370d448](https://github.com/lbwa/esw/commit/370d448320bdbbf78a33b7502200f99e8a395df2))
- **esw:** initial watch mode implementation ([9594450](https://github.com/lbwa/esw/commit/9594450972daa2fde6811dfd58aa95581b6405ab))
- **esw:** set incretmental: true by default when we are in watch mode ([d694121](https://github.com/lbwa/esw/commit/d694121b2a42351f0b1045aa56ec5a8c020b46f1))
- **esw:** setup watch mode ([e00ec30](https://github.com/lbwa/esw/commit/e00ec308003f339b632844c8b8e4fe104029189c))

# [0.9.0](https://github.com/lbwa/esw/compare/esw@0.8.0...esw@0.9.0) (2021-09-19)

### Bug Fixes

- **esw:** should always print esw writting path ([b796cfb](https://github.com/lbwa/esw/commit/b796cfbaf506a6d48607cc3583cdf937b56bde64))
- **esw:** should keep correct output format ([df2200d](https://github.com/lbwa/esw/commit/df2200d8c071bba4a4b67c84554d29e0432fa899))

### Features

- **esw:** support clean dist before building start ([04dffdd](https://github.com/lbwa/esw/commit/04dffdd8d6939b4d100d952936db32f49b84c14c))

# [0.8.0](https://github.com/lbwa/esw/compare/esw@0.7.3...esw@0.8.0) (2021-09-12)

### Bug Fixes

- **esw:** should write common chunk to local disk when splitting enabled ([7d31000](https://github.com/lbwa/esw/commit/7d31000a00e0dae80edf274baa1ff821d74371f6))

### Features

- **esw:** handle esbuild stdout by default ([ac007a3](https://github.com/lbwa/esw/commit/ac007a39673474040f668ac8b3aaf51ebb63c67e))

### Performance Improvements

- **esw:** make external deps be the first plugin ([efa7f13](https://github.com/lbwa/esw/commit/efa7f1345cd88c0173b56688a70cc43e941b971a))

## [0.7.3](https://github.com/lbwa/esw/compare/esw@0.7.2...esw@0.7.3) (2021-09-09)

### Bug Fixes

- **esw:** should use path.join to join multiple path segments ([0641352](https://github.com/lbwa/esw/commit/0641352c4d838fe0d7190234e3dd7d00f753204e))

## [0.7.2](https://github.com/lbwa/esw/compare/esw@0.7.1...esw@0.7.2) (2021-09-08)

### Bug Fixes

- **esw:** format usage ([68e1fc6](https://github.com/lbwa/esw/commit/68e1fc65a06e33afa351bb1eb7b94f4292ee5e99))

## [0.7.1](https://github.com/lbwa/esw/compare/esw@0.7.0...esw@0.7.1) (2021-09-07)

**Note:** Version bump only for package esw

# [0.7.0](https://github.com/lbwa/esw/compare/esw@0.6.0...esw@0.7.0) (2021-09-07)

### Bug Fixes

- **esw:** should exit with code 1 when build failed ([3febd4b](https://github.com/lbwa/esw/commit/3febd4bfdf821d3150a755cf296947fcf3d5f53d))

### Features

- **esw:** output a build report when build accomplished ([e32abb1](https://github.com/lbwa/esw/commit/e32abb18616bd078d8b3879e276e430d97eaeba8))
- **esw:** throw a error when user forgot define main and module fields ([953450f](https://github.com/lbwa/esw/commit/953450f387953613029a32c71e099a97e85e5c8b))
- **esw:** we don't print usage any more when unknown args occurs ([ddd040c](https://github.com/lbwa/esw/commit/ddd040c9c1dfcc51bb89e5c4a224ee9831599688))

# [0.6.0](https://github.com/lbwa/esw/compare/esw@0.5.0...esw@0.6.0) (2021-09-02)

### Bug Fixes

- should always respect main and module field value in package.json ([#20](https://github.com/lbwa/esw/issues/20)) ([d3a11a8](https://github.com/lbwa/esw/commit/d3a11a8bbf8d3accf42fe7ab4cc63f1fe19fa387)), closes [#15](https://github.com/lbwa/esw/issues/15)

### Features

- **esw:** avoid duplicated building when we set duplicated path ([#19](https://github.com/lbwa/esw/issues/19)) ([9fa0c71](https://github.com/lbwa/esw/commit/9fa0c719255a477dd53cbb0e35c5230da179b8c6))
- **esw:** handle emit output files from esw internal ([65dd106](https://github.com/lbwa/esw/commit/65dd10643558a205a8b1b2a342703ecc9cbe260e))

# [0.5.0](https://github.com/lbwa/esw/compare/esw@0.4.1...esw@0.5.0) (2021-08-28)

### Bug Fixes

- **esw:** --version should return a EMPTY observable ([a3498a7](https://github.com/lbwa/esw/commit/a3498a78244311a54d5343611f3db5ffbdc8608e))

### Features

- **esw:** make entry point inferrence error more clearable ([b5ec7ff](https://github.com/lbwa/esw/commit/b5ec7ff173731642401aa37b65d409391669f2be))

## [0.4.1](https://github.com/lbwa/esw/compare/esw@0.4.0...esw@0.4.1) (2021-08-27)

### Bug Fixes

- **esw:** should respect the --help of subcommand ([a57052e](https://github.com/lbwa/esw/commit/a57052e654301616bb72be69d2bb44cfdb3b26fb)), closes [#14](https://github.com/lbwa/esw/issues/14)

# [0.4.0](https://github.com/lbwa/esw/compare/esw@0.3.0...esw@0.4.0) (2021-08-26)

### Features

- **esw:** print warnings when no valid building options created ([0074587](https://github.com/lbwa/esw/commit/007458775a476dc88e24512226550b6b8a5d6480))

# [0.3.0](https://github.com/lbwa/esw/compare/esw@0.2.1...esw@0.3.0) (2021-08-25)

### Bug Fixes

- **esw:** add missing dep ([6a9d79a](https://github.com/lbwa/esw/commit/6a9d79a6c4d9efd54fe89e44ac35c39f40961d83))
- **esw:** module field should always be treated as ESM format ([33b9cbf](https://github.com/lbwa/esw/commit/33b9cbf46c17bf17c618338a61b076438feeb0c1))
- **esw:** module field should always be treated as ESM format ([6a45a2b](https://github.com/lbwa/esw/commit/6a45a2b95aa6cafdd8dbd1c4efae203c71780267))
- **esw:** should complete current obs when input wrong/help command ([721af0b](https://github.com/lbwa/esw/commit/721af0bfc1fe608e0949d83292810fb8df96bd7b))

### Features

- **esw:** support to infer outdir ([3aece7e](https://github.com/lbwa/esw/commit/3aece7e3b253ee16b86e331c890b304213924ae0))
- **esw:** upgrade esbuild@0.12.22 ([bcf5120](https://github.com/lbwa/esw/commit/bcf5120c2512bf876f06a636fbb72247a0f2288b))
- **esw:** upgrade rxjs@7.3.0 ([b965885](https://github.com/lbwa/esw/commit/b965885898e8b01b67d36130395c091f417f6eae))
- multiple builds would sent only one notification to observer ([#12](https://github.com/lbwa/esw/issues/12)) ([f6002a1](https://github.com/lbwa/esw/commit/f6002a1cb3cab9889468b8e6a3b71a290b218fd6))
- upgrade esbuild@v0.12.20 ([e129d7b](https://github.com/lbwa/esw/commit/e129d7bc5567c49fe82ac8fb83ea7ed7208ea578))

## [0.2.1](https://github.com/lbwa/esw/compare/esw@0.2.0...esw@0.2.1) (2021-07-24)

### Bug Fixes

- should handle pakage.json access error ([0255599](https://github.com/lbwa/esw/commit/02555992c933fa29950d6fa4d2b605eb195103be))

# [0.2.0](https://github.com/lbwa/esw/compare/esw@0.1.0...esw@0.2.0) (2021-07-19)

### Bug Fixes

- **esw:** should filter valid project entry points ([8c5362f](https://github.com/lbwa/esw/commit/8c5362ff1b13fda822b7f6e2640fe4a4d30256e6))
- infer entryPoints and outdir ([5c11a64](https://github.com/lbwa/esw/commit/5c11a64b30f86001bd30d31b77da26518b21020d))

### Features

- make lodash as external dep ([44e8e21](https://github.com/lbwa/esw/commit/44e8e216a63243219062f018b13183773c3c5319))
- support concurrent build when there are main and module fields ([53a1e3c](https://github.com/lbwa/esw/commit/53a1e3cff3ba96a5af49c46675db6753efda0a19)), closes [#6](https://github.com/lbwa/esw/issues/6)
- use tuple as arg value type ([6b999d5](https://github.com/lbwa/esw/commit/6b999d51e65d359f989c549d068f3473ee884911))

# [0.1.0](https://github.com/lbwa/esw/compare/esw@0.0.1-alpha.1...esw@0.1.0) (2021-07-18)

### Features

- build cli work with node api ([b4d659a](https://github.com/lbwa/esw/commit/b4d659a38483f4fa9351ea7dbae034771934150b))
- map esbuild option to commandline ([e8e0a22](https://github.com/lbwa/esw/commit/e8e0a223a59c97925901f3d730e24cae837da9bc))
