# sass-esbuild-plugin

Handle all `*.s{a,c}ss` files in the esbuild.

## Usage

```js
const sass = require('sass-esbuild-plugin')

require('esbuild').buildSync({
  plugins: [sass()]
})
```

## License

MIT © [Liu Bowen](https://github.com/lbwa)
