/* eslint-disable no-console */

// Keys that are commonly boolean on native views / navigation
const BOOL_KEYS = new Set([
  'headerShown',
  'gestureEnabled',
  'animationEnabled',
  'enabled',
  'disabled',
  'visible',
  'hidden',
  'transparent',
  'scrollEnabled',
  'bounces',
  'pagingEnabled',
  'horizontal',
  'inverted',
  'refreshing',
  'removeClippedSubviews',
  'showsVerticalScrollIndicator',
  'showsHorizontalScrollIndicator',
  'statusBarHidden',
  'secureTextEntry',
  'collapsable',
  'focusable',
]);

const BOOL_KEY_RE =
  /^(is[A-Z]|has[A-Z]|should[A-Z]).*|.*(Enabled|Disabled|Hidden|Visible|Open|Closed)$/;

const seen = new Set<string>();

function wrap(mod: any, fnName: string) {
  const orig = mod?.[fnName];
  if (!orig || (orig as any).__wrapped) return;

  mod[fnName] = function (type: any, props: any, key: any) {
    if (props && typeof props === 'object') {
      for (const [k, v] of Object.entries(props)) {
        // IMPORTANT: log ANY string for likely-boolean keys (not just "true"/"false")
        if (typeof v === 'string' && (BOOL_KEYS.has(k) || BOOL_KEY_RE.test(k))) {
          const comp =
            typeof type === 'string'
              ? type
              : type?.displayName || type?.name || 'UnknownComponent';
          const sig = `${comp}.${k}=${v}`;
          if (!seen.has(sig)) {
            seen.add(sig);
            console.error(
              `[BOOLEAN-STRING PROP] ${comp}.${k}="${v}"`,
              '\nStack:\n',
              new Error().stack
            );
          }
        }
      }
    }
    return orig.apply(this, arguments as any);
  };

  (mod[fnName] as any).__wrapped = true;
}

export function installJsxRuntimeBooleanStringDetector() {
  const jsxRuntime = require('react/jsx-runtime');
  wrap(jsxRuntime, 'jsx');
  wrap(jsxRuntime, 'jsxs');

  try {
    const jsxDev = require('react/jsx-dev-runtime');
    wrap(jsxDev, 'jsxDEV');
  } catch {
    // jsx-dev-runtime may not exist in production builds
  }
}

