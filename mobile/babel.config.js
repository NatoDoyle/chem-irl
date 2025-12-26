module.exports = function (api) {
  api.cache(true);

  // Custom plugin to strip TypeScript "as" casts before parsing
  const stripTsAsCastsPlugin = function () {
    const babelParser = require('@babel/parser');
    
    return {
      name: 'strip-ts-as-casts',
      parserOverride(code, opts) {
        // Only preprocess if file contains TS "as" syntax (avoid breaking pure Flow files)
        // Also skip if file uses component() syntax (pure Flow indicator)
        const hasTsAsSyntax = /\s+as\s+[A-Za-z0-9_$]/.test(code);
        const hasComponentSyntax = /=\s*component\s*\(/.test(code);
        
        if (!hasTsAsSyntax || hasComponentSyntax) {
          // Pure Flow file - use default parser (babel-preset-expo)
          // Return undefined to let Babel use the default parser from presets
          return undefined;
        }
        
        // Preprocess: strip TS "as Type" casts and multiline JestMockFn patterns
        let preprocessed = code;
        
        // 0) Global pass: strip ALL "as Type" patterns aggressively
        // This must happen before line-by-line processing to catch all cases
        // Pattern: (identifier as Type) -> (identifier)
        preprocessed = preprocessed.replace(
          /\(([^()]+?)\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?\)/g,
          '($1)'
        );
        // Pattern: identifier as Type -> identifier (but not import * as X)
        preprocessed = preprocessed.replace(
          /([^a-zA-Z_$]|^)([A-Za-z_$][\w$]*)\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?(?![*\s]as)/g,
          '$1$2'
        );
        
        // 1) Strip multiline jest.fn() as JestMockFn<...> patterns (with trailing comma)
        preprocessed = preprocessed.replace(
          /jest\.fn\([^\n]*\)\s+as\s+JestMockFn<[\s\S]*?>\s*,/g,
          'jest.fn(),'
        );
        
        // 2) Strip multiline jest.fn() as JestMockFn<...> patterns (without trailing comma)
        preprocessed = preprocessed.replace(
          /jest\.fn\([^\n]*\)\s+as\s+JestMockFn<[\s\S]*?>/g,
          'jest.fn()'
        );
        
        // 3) Strip jest.fn(...)<...> generic instantiation (multiline)
        preprocessed = preprocessed.replace(
          /(jest\.fn\([^\n]*\))\s*<[\s\S]*?>\s*,/g,
          '$1,'
        );
        preprocessed = preprocessed.replace(
          /(jest\.fn\([^\n]*\))\s*<[\s\S]*?>/g,
          '$1'
        );
        
        // 4) Remove orphaned type parameter lines (>, $FlowFixMe, etc.)
        preprocessed = preprocessed.replace(/^\s*\$FlowFixMe,?\s*$/gm, '');
        preprocessed = preprocessed.replace(/^\s*>,\s*$/gm, '');
        preprocessed = preprocessed.replace(/^\s*<\s*$/gm, '');
        
        // 5) Strip remaining "as Type" casts on single lines (but preserve "import * as X")
        preprocessed = preprocessed
          .split('\n')
          .map((line) => {
            // Don't touch imports
            if (/^\s*import\b/.test(line)) return line;
            // Strip "as Type" patterns
            // Handle: identifier as Type, (expr) as Type, [expr] as Type, {expr} as Type
            let l = line
              .replace(/\b([A-Za-z_$][\w$]*)\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g, '$1')
              .replace(/([)\]}])\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g, '$1');
            // Also handle (identifier as Type) patterns more aggressively
            l = l.replace(/\(\s*([A-Za-z_$][\w$]*)\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?\s*\)/g, '($1)');
            return l;
          })
          .join('\n');
        // Parse with Flow parser only (can't combine Flow + TS plugins)
        // TS "as" casts are already stripped by preprocessing above
        return babelParser.parse(preprocessed, {
          sourceType: 'module',
          plugins: ['flow', 'flowComments', 'jsx'],
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
          allowUndeclaredExports: true,
          // Allow statements without semicolons (for component() type syntax)
          allowSuperOutsideMethod: false,
          errorRecovery: false,
        });
      },
    };
  };

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include mixed Flow + TS syntax in .js files.
    // Preprocess to strip TS "as" casts before Flow parser runs.
    // Note: setup.js uses only Flow syntax, so it's excluded (uses babel-preset-expo).
      overrides: [
      {
        // React Native files with mixed Flow + TS syntax
        // Match: jest/mock.js, jest/mocks/**/*.js, index.js
        // Exclude: jest/setup.js, jest/mockNativeComponent.js (pure Flow, no TS syntax)
        test: (filename) => {
          // Normalize path separators
          const normalized = filename.replace(/\\/g, '/');
          
          // First, exclude pure Flow files explicitly (before checking match)
          if (normalized.includes('/react-native/jest/setup.js')) return false;
          if (normalized.includes('/react-native/jest/mockNativeComponent.js')) return false;
          
          // Then check if it matches our pattern
          const match = /node_modules\/react-native\/(jest\/(mocks\/.*|mock\.js)|index)\.js$/.test(normalized);
          return match;
        },
        presets: ['babel-preset-expo'],
        plugins: [stripTsAsCastsPlugin],
      },
    ],
  };
};

