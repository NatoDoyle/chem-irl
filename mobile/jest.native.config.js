// Configuration for React Native/Expo component tests
// Use this for testing components that require React Native's Jest setup
// Run with: npm run test:native

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.native.(ts|tsx|js)',
    '<rootDir>/src/**/__tests__/**/*.test.component.(ts|tsx|js)',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-.*|expo|expo-.*|@expo|@expo-.*|expo-modules-core)/)',
  ],
  fakeTimers: {
    enableGlobally: true,
  },
};
