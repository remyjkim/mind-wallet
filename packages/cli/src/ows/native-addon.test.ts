import { describe, expect, it } from 'vitest';
import {
  getNativeTargetId,
  getOwsNativeAddonFilename,
  resolveOwsNativeAddonPath,
} from './resolve-native-addon.js';

describe('resolveOwsNativeAddonPath', () => {
  it('prefers MINDWALLET_OWS_NATIVE_PATH when set', () => {
    expect(resolveOwsNativeAddonPath({
      env: { MINDWALLET_OWS_NATIVE_PATH: '/tmp/custom-ows.node' } as NodeJS.ProcessEnv,
    })).toBe('/tmp/custom-ows.node');
  });

  it('discovers a colocated addon next to the executable', () => {
    expect(resolveOwsNativeAddonPath({
      env: {} as NodeJS.ProcessEnv,
      execPath: '/tmp/mindwallet',
      platform: 'darwin',
      arch: 'arm64',
      exists: (path) => path === '/tmp/ows/ows-node.darwin-arm64.node',
    })).toBe('/tmp/ows/ows-node.darwin-arm64.node');
  });
});

describe('getOwsNativeAddonFilename', () => {
  it('maps darwin arm64 to the darwin addon filename', () => {
    expect(getOwsNativeAddonFilename('darwin', 'arm64')).toBe('ows-node.darwin-arm64.node');
  });

  it('maps linux x64 to the glibc addon filename', () => {
    expect(getOwsNativeAddonFilename('linux', 'x64')).toBe('ows-node.linux-x64-gnu.node');
  });
});

describe('getNativeTargetId', () => {
  it('returns a stable target identifier', () => {
    expect(getNativeTargetId('darwin', 'arm64')).toBe('darwin-arm64');
  });
});
