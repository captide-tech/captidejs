/**
 * Custom dynamic import function that works with or without Next.js
 * 
 * This provides a unified API for dynamic imports across different environments.
 * In Next.js environments, it uses next/dynamic.
 * In non-Next.js environments, it provides a simple dynamic import wrapper.
 */

import React from 'react';

// More reliable browser detection
const isBrowser = typeof window !== 'undefined' && 
                  typeof document !== 'undefined';

// Check if we're in a Next.js environment
const hasNextJs = typeof process !== 'undefined' && 
                 typeof process.env !== 'undefined' && 
                 typeof require !== 'undefined';

interface DynamicOptions {
  ssr?: boolean;
  loading?: React.ComponentType<any>;
}

/**
 * Dynamically import a component with options for SSR
 * 
 * @param importFunc - A function that returns a promise for a React component
 * @param options - Options for dynamic import (ssr, loading component)
 * @returns A dynamically imported React component
 */
const dynamicImport = <P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  options: DynamicOptions = { ssr: true }
): React.ComponentType<P> | React.LazyExoticComponent<React.ComponentType<P>> => {
  const { ssr = true, loading: LoadingComponent } = options;
  
  // If we're in a Next.js environment, use next/dynamic
  if (hasNextJs) {
    try {
      // Using require here because this is conditional code
      // This prevents errors when bundling for non-Next.js environments
      const dynamic = require('next/dynamic').default;
      
      return dynamic(
        importFunc,
        { 
          ssr,
          loading: LoadingComponent 
            ? () => React.createElement(LoadingComponent) 
            : undefined
        }
      );
    } catch (e) {
      // Fall through to basic implementation
    }
  }
  
  // Basic implementation for non-Next.js environments
  return React.lazy(importFunc);
};

export default dynamicImport; 