module.exports = function (api) {
  api.cache(true);

  // Custom plugin to strip TypeScript "as" casts before parsing
  const stripTsAsCastsPlugin = function () {
    const babelParser = require('@babel/parser');
    
    return {
      name: 'strip-ts-as-casts',
      parserOverride(code) {
        // Preprocess: strip TS "as Type" casts and multiline JestMockFn patterns
        let preprocessed = code;
        
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
            return line
              .replace(/\b([A-Za-z_$][\w$]*)\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g, '$1')
              .replace(/([)\]}])\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g, '$1');
          })
          .join('\n');
        // Parse with Flow parser only (can't combine Flow + TS plugins)
        // TS "as" casts are already stripped by preprocessing above
        return babelParser.parse(preprocessed, {
          sourceType: 'module',
          plugins: ['flow', 'flowComments', 'jsx'],
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true,
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
        // Match: jest/mock.js, jest/mocks/**/*.js, jest/**/*.js, index.js
        test: /node_modules\/react-native\/(jest\/.*|index)\.js$/,
        presets: ['babel-preset-expo'],
        plugins: [stripTsAsCastsPlugin],
      },
    ],
  };
};

