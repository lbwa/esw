<h1 align="center">esw</h1>

<p align="center">
  <a href="https://github.com/lbwa/esw/actions/workflows/test.yml">
    <img alt="github action" src="https://github.com/lbwa/esw/actions/workflows/test.yml/badge.svg"/>
  </a>
  <img alt="npm (tag)" src="https://img.shields.io/npm/v/esw/latest?style=flat-square">
  <img alt="node-current" src="https://img.shields.io/node/v/esw?style=flat-square">
</p>

A extremely fast JavaScript/TypeScript library build tool based on [esbuild](https://github.com/evanw/esbuild).

## Installation

- using npm

  ```bash
  npm install esw --dev
  ```

- using yarn

  ```bash
  yarn add esw --dev
  ```

## Getting Started

3 steps to get started:

1. ⚒️ Define project's `main` or `module` or both fields in `package.json`.

2. 👨‍💻 Run `esw build` to build the project from root path.

3. 💥 Boom! Everything is completed. You can find the built files in `main` or `module` or both field's path.

> ⚠️ TO BE NOTICE: `module` field always be treated as `ES module` format. More details in [nodejs.org](https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages).

## Advanced Usage

esw has supported the most of [esbuild](https://github.com/evanw/esbuild) options. e.g:

```bash
esw build --minify --sourcemap --bundle --target=es2019 --format=esm
```

## License

[MIT](./LICENSE) © [Liu Bowen](https://github.com/lbwa)
