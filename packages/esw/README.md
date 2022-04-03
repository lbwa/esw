# esw

[![github action](https://github.com/lbwa/esw/actions/workflows/test.yml/badge.svg)](https://github.com/lbwa/esw/actions) [![npm (tag)](https://img.shields.io/npm/v/esw/latest?style=flat-square)](https://www.npmjs.com/package/esw) [![node-current](https://img.shields.io/node/v/esw?style=flat-square)](https://nodejs.org/en/download/)

`esw` is a JavaScript/TypeScript library build tool. It offers blazing fast performance utilizing [esbuild](https://esbuild.github.io), and **requires zero configuration**.

**✨Passive usage**

Infer build options from `package.json` by default. Ideally you don't need to write any configurations. Also support multiple entry points via glob syntax(eg. `esw src/**/*.ts --outdir=dist`) if necessary.

**📦Optimized bundling**

Driven by esbuild and only bundle codebase without any [dependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/#dependencies) and [peerDependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/#peerdependencies) by default.

## Installation

```console
npm i esw -D
```

## Getting Started

3 steps to get started:

1. 🖊 declare [main][pkg-main] or [module][pkg-module] or both them in the [package.json](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/).

   ```json
   {
     "name": "esw",
     "main": "dist/index.cjs.js",
     "module": "dist/index.esm.js"
   }
   ```

   > ⚠️ The output format what `module` field refers to always be treated as `esm`<sup>[why](https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages)</sup>.

2. 🏃‍ Run `esw build` from the working directory.

   ```bash
   esw build
   ```

3. 🏆 All transpiled products would be placed in the target output path which were inferred by esw.

   ```
   codebase root
    └─dist
       ├─index.cjs.js
       └─index.esm.js
   ```

## Advanced Usage

esw has supported the most of [esbuild](https://github.com/evanw/esbuild) cli options:

```bash
esw build --minify --sourcemap --platform=node --format=esm
```

### Build codebase

```bash
esw build src/*.ts
```

### Watch codebase

```bash
esw watch src/index.ts
```

### Supported source file types

Please refer to [esbuild documentation](https://esbuild.github.io/content-types/).

## Supported package.json fields

|      Field name      | Status |
| :------------------: | :----: |
|   [main][pkg-main]   |   ✔    |
| [module][pkg-module] |   ✔    |
|   [type][pkg-type]   |   ✔    |

[pkg-main]: https://docs.npmjs.com/cli/v8/configuring-npm/package-json#main
[pkg-module]: https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#packages_dual_commonjs_es_module_packages
[pkg-type]: https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#type

## License

[MIT](./LICENSE) © [Liu Bowen](https://github.com/lbwa)
