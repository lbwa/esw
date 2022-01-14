# esw

[![github action](https://github.com/lbwa/esw/actions/workflows/test.yml/badge.svg)](https://github.com/lbwa/esw/actions) [![npm (tag)](https://img.shields.io/npm/v/esw/latest?style=flat-square)](https://www.npmjs.com/package/esw) [![node-current](https://img.shields.io/node/v/esw?style=flat-square)](https://nodejs.org/en/download/)

`esw` is a JavaScript/TypeScript library build tool. It offers blazing fast performance utilizing [esbuild](https://esbuild.github.io), and requires zero configuration.

- No more build scripts or configs. esw has supported **automatic build option inference**.
- Smaller bundle size. It wouldn't bundle any `dependencies` or `peerDependencies` by default.
- The most of web project source file type has been supported by default, eg. TypeScript/JavaScript/JSX/CSS([experimental](https://esbuild.github.io/content-types/#css))

## Installation

- using npm

  ```console
  npm i esw --save-dev
  ```

- using yarn

  ```console
  yarn add esw -D
  ```

- using pnpm

  ```console
  pnpm i esw -D
  ```

## Getting Started

3 steps to get started:

1. 🖊 declare [main](https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#main) or [module](https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages) or both them in the `package.json`.

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
   project
    └─dist
       ├─index.cjs.js
       └─index.esm.js
   ```

## Advanced Usage

esw has supported the most of [esbuild](https://github.com/evanw/esbuild) cli options. e.g:

```bash
esw build --minify --sourcemap --target=es2019 --format=esm
```

### Build codebase

```bash
esw build
```

### Watch codebase

```bash
esw watch
```

### Supported source file types

Please refer to [esbuild documentation](https://esbuild.github.io/content-types/).

## License

[MIT](./LICENSE) © [Liu Bowen](https://github.com/lbwa)
