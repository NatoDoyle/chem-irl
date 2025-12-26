module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/lib/__tests__/**/*.test.(ts|tsx|js)',
    '<rootDir>/src/config/__tests__/**/*.test.(ts|tsx|js)',
  ],
  // Use babel-jest which will automatically use babel.config.js
  // The complex preprocessing in babel.config.js only applies to react-native files,
  // so unit tests won't trigger it
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  setupFiles: ['<rootDir>/jest.unit.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/config/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
};

