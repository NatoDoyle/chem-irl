// Top-level React error boundary. Catches render-time crashes anywhere
// below it (most importantly the entire navigation tree). Reports the
// error to Sentry with `severity:critical` + `boundary:app-root` tags
// and shows a retry-able fallback so the app doesn't white-screen.
//
// Limitations (inherent to React error boundaries):
//   - Does NOT catch async errors (promise rejections, setTimeout).
//   - Does NOT catch errors in event handlers (those need try/catch).
//   - Does NOT catch errors thrown by the boundary itself or its fallback.
//
// Styles are self-contained (no brand-token imports) so a brand-token
// breakage can never crash the boundary's own render.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ERROR_KINDS, ERROR_LAYERS, ERROR_SEVERITIES } from '../lib/errors';
import { captureWithTags } from '../lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureWithTags(error, {
      layer: ERROR_LAYERS.Mobile,
      kind: ERROR_KINDS.Unknown,
      severity: ERROR_SEVERITIES.Critical,
      tags: { boundary: 'app-root' },
      extra: { componentStack: errorInfo.componentStack ?? null },
    });
  }

  reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app hit an unexpected error. Tap below to try again.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Hardcoded colors mirror MIDNIGHT/BRAND_COLORS so the fallback stays
// visually consistent without importing the brand module (so brand-token
// breakage can never crash the boundary itself).
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0a0a0f',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f5f5f7',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#a8a8b3',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#7fffd4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: '600',
  },
});
