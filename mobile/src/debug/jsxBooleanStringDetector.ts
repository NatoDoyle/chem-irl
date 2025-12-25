// src/debug/jsxBooleanStringDetector.ts
/* eslint-disable no-console */

// Curated + pattern-based detection: only logs when a prop is a STRING on a likely-boolean key.
const BOOLEAN_KEYS = new Set([
    "enabled",
    "disabled",
    "visible",
    "hidden",
    "open",
    "isOpen",
    "isVisible",
    "modalVisible",
    "transparent",
    "collapsable",
    "scrollEnabled",
    "bounces",
    "pagingEnabled",
    "horizontal",
    "inverted",
    "refreshing",
    "removeClippedSubviews",
    "showsVerticalScrollIndicator",
    "showsHorizontalScrollIndicator",
    "headerShown",
    "gestureEnabled",
    "animationEnabled",
    "freezeOnBlur",
    "detachInactiveScreens",
    "statusBarHidden",
    "secureTextEntry",
    "useNativeDriver",
  ]);
  
  const BOOLEAN_KEY_RE =
    /^(is[A-Z]|has[A-Z]|should[A-Z])|Enabled$|Disabled$|Hidden$|Visible$|Open$|Closed$/;
  
  function isLikelyBooleanKey(k: string) {
    return BOOLEAN_KEYS.has(k) || BOOLEAN_KEY_RE.test(k);
  }
  
  function wrapRuntime(runtime: any, fnName: string) {
    const orig = runtime?.[fnName];
    if (!orig || orig.__wrapped) return;
  
    runtime[fnName] = function (type: any, props: any, key: any) {
      if (props && typeof props === "object") {
        for (const [k, v] of Object.entries(props)) {
          if (typeof v === "string" && isLikelyBooleanKey(k)) {
            const comp =
              typeof type === "string"
                ? type
                : type?.displayName || type?.name || "UnknownComponent";
            const stack = new Error().stack;
            console.error(
              `[BOOLEAN-STRING PROP] ${comp}.${k}="${v}"`,
              "\nStack:\n",
              stack
            );
          }
        }
      }
      return orig.apply(this, arguments as any);
    };
  
    runtime[fnName].__wrapped = true;
  }
  
  export function installJsxBooleanStringDetector() {
    // CommonJS require so we can monkey-patch exports
    const jsxRuntime = require("react/jsx-runtime");
    wrapRuntime(jsxRuntime, "jsx");
    wrapRuntime(jsxRuntime, "jsxs");
  
    // Dev runtime path (sometimes used)
    try {
      const jsxDevRuntime = require("react/jsx-dev-runtime");
      wrapRuntime(jsxDevRuntime, "jsxDEV");
    } catch {}
  }
  