import { createRequire } from 'node:module';
import { resolveOwsNativeAddonPath } from './resolve-native-addon.js';

export type OwsBindings = typeof import('@open-wallet-standard/core');

let owsBindingsPromise: Promise<OwsBindings> | undefined;

export function loadOws(): Promise<OwsBindings> {
  owsBindingsPromise ??= loadOwsImpl();
  return owsBindingsPromise;
}

async function loadOwsImpl(): Promise<OwsBindings> {
  const addonPath = resolveOwsNativeAddonPath();
  if (addonPath) {
    const require = createRequire(import.meta.url);
    return require(addonPath) as OwsBindings;
  }

  return import('@open-wallet-standard/core');
}
