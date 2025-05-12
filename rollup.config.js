import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';

const packageJson = require('./package.json');

const config = {
  input: 'src/index.ts',
  // Tell Rollup which external modules to not bundle
  external: [
    'react', 
    'react-dom',
    'next/dynamic',
    'pdfjs-dist'
  ],
  plugins: [
    // Don't bundle peer dependencies
    peerDepsExternal(),
    
    // Replace certain text in files
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
    
    // Locate modules in node_modules
    resolve({
      browser: true, // Prefer browser versions of modules
      preferBuiltins: false,
    }),
    
    // Convert CommonJS modules to ES6
    commonjs(),
    
    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      exclude: ['**/__tests__/**']
    }),
    
    // Minify the output
    terser()
  ]
}; 

// Generate both CJS and ESM builds
export default [
  // CommonJS build
  {
    ...config,
    output: {
      file: packageJson.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true
    }
  },
  // ESM build
  {
    ...config,
    output: {
      file: packageJson.module,
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true
    }
  }
]; 