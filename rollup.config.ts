import { defineConfig } from 'rollup'
import { swc } from 'rollup-plugin-swc3'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { threeMinifier } from '@yushijinhun/three-minifier-rollup'

export default defineConfig({
  input: 'src/skinview3d.ts',
  output: [
    {
      format: 'commonjs',
      file: 'libs/skinview3d.cjs'
    },
    {
      format: 'es',
      file: 'libs/skinview3d.mjs'
    }
  ],
  plugins: [
    // threeMinifier(),
    resolve(),
    // swc({
    // 	jsc: { minify: { compress: true, mangle: true, sourceMap: true } },
    // 	minify: true,
    // 	sourceMaps: true,
    // }),
    typescript()
  ],
  external(source, importer, isResolved) {
    return source.startsWith('three') || ['skia-canvas', 'skinview-utils','pngjs','gl'].includes(source)
  }
})
