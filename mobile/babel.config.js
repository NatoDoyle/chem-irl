module.exports = function (api) {
  api.cache(true);

  // Custom plugin to strip TypeScript "as" casts before parsing
  const stripTsAsCastsPlugin = function () {
    const babelParser = require('@babel/parser');
    
    return {
      name: 'strip-ts-as-casts',
      parserOverride(code) {
        // Preprocess: strip TS "as Type" casts (but preserve "import * as X")
        const preprocessed = code
          .split('\n')
          .map((line) => {
            // Don't touch imports
            if (/^\s*import\b/.test(line)) return line;
            // Strip "as Type" patterns (identifier as Type, ) as Type, etc.)
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
        test: /node_modules\/react-native\/jest\/(mocks\/.*|mock)\.js$/,
        presets: ['babel-preset-expo'],
        plugins: [stripTsAsCastsPlugin],
      },
    ],
  };
};

