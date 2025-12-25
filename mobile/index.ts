import { registerRootComponent } from 'expo';
import { installJsxRuntimeBooleanStringDetector } from './src/debug/jsxRuntimeBooleanStringDetector';

// Install JSX runtime detector BEFORE App is imported
// This patches react/jsx-runtime to catch string boolean props
installJsxRuntimeBooleanStringDetector();

// Require AFTER installing detector so the patched jsx/jsxs are used
// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
