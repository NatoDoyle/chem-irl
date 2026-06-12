import appJson from '../../../app.json';
import easJson from '../../../eas.json';

// Store-submission invariants (launch roadmap T1.5). These encode Apple /
// Google Play submission requirements as regression guards: CI fails if
// the config drifts back to a non-submittable state.

type PluginEntry = string | [string, Record<string, unknown>?];

describe('store submission config', () => {
  it('builds production Android as app-bundle (Play rejects APK uploads)', () => {
    expect(easJson.build.production.android.buildType).toBe('app-bundle');
  });

  it('manages build numbers remotely with auto-increment on production', () => {
    expect((easJson.cli as Record<string, unknown>).appVersionSource).toBe('remote');
    expect((easJson.build.production as Record<string, unknown>).autoIncrement).toBe(true);
  });

  it('is phone-only on iOS — no iPad screenshot/layout surface at review', () => {
    expect(appJson.expo.ios.supportsTablet).toBe(false);
  });

  it('requests no RECORD_AUDIO permission (unused; triggers Play data-safety friction)', () => {
    const android = appJson.expo.android as unknown as {
      permissions?: string[];
      blockedPermissions?: string[];
    };
    expect(android.permissions ?? []).not.toContain('android.permission.RECORD_AUDIO');
    expect(android.blockedPermissions ?? []).toContain('android.permission.RECORD_AUDIO');
  });

  it('declares an explicit camera permission string and no microphone for expo-image-picker', () => {
    const plugins = appJson.expo.plugins as unknown as PluginEntry[];
    const picker = plugins.find(
      (p): p is [string, Record<string, unknown>] =>
        Array.isArray(p) && p[0] === 'expo-image-picker'
    );
    expect(picker).toBeDefined();
    expect(String(picker?.[1]?.cameraPermission ?? '')).toMatch(/camera/i);
    expect(picker?.[1]?.microphonePermission).toBe(false);
  });
});
