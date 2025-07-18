import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import replace from '@rollup/plugin-replace';
import alias from '@rollup/plugin-alias';
import path from 'path';

const packageJson = require('./package.json');
const isProduction = process.env.NODE_ENV === 'production';

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
    
    // Handle TypeScript path mappings
    alias({
      entries: [
        { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
        { find: '@contexts', replacement: path.resolve(__dirname, 'src/contexts') },
        { find: '@types', replacement: path.resolve(__dirname, 'src/types/index.ts') }
        // Removed @utils alias as the directory no longer exists
      ]
    }),
    
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
    ...(isProduction ? [require('rollup-plugin-terser').terser()] : [])
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