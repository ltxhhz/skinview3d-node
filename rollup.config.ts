import { defineConfig } from 'rollup'
import { swc } from 'rollup-plugin-swc3'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript'
import { threeMinifier } from '@yushijinhun/three-minifier-rollup'

export default defineConfig({
  input: 'src/skinview3d.ts',
  output: [
    {
      format: 'commonjs',
      file: 'libs/skinview3d.cjs',
			exports: 'named'
    },
    {
      format: 'es',
      file: 'libs/skinview3d.mjs'
    }
  ],
  plugins: [
    // threeMinifier(),
		commonjs(),
    resolve(),
    // swc({
    // 	jsc: { minify: { compress: true, mangle: true, sourceMap: true } },
    // 	minify: true,
    // 	sourceMaps: true,
    // }),
    typescript()
  ],
  external(source, importer, isResolved) {
    // 1. 将 'three' 核心库设为外部依赖 (也就是 require('three'))
    if (source === 'three') {
      return true;
    }

    // 2. 确保 'three/examples/jsm/...' 被 Rollup 处理并打包进去，而不是设为外部依赖。
    // 如果你之前的 external 写法是 /three/ 或 ['three']，可能会无意中把 jsm 也排除了。
    // 这里我们明确返回 false，表示需要打包。
    if (source.includes('three/examples/jsm')) {
      return false;
    }

    // 其他逻辑...
    return ['skia-canvas', 'skinview-utils','pngjs','gl'].includes(source)
  }
})
