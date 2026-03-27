import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

type SupportedPlatform = 'darwin' | 'linux';
type SupportedArch = 'arm64' | 'x64';

export interface ResolveNativeAddonOptions {
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  exists?: (path: string) => boolean;
  platform?: NodeJS.Platform;
  arch?: string;
}

export function getOwsNativeAddonFilename(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string | undefined {
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) {
    return `ows-node.darwin-${arch}.node`;
  }

  if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) {
    return `ows-node.linux-${arch}-gnu.node`;
  }

  return undefined;
}

export function getNativeTargetId(
  platform: SupportedPlatform,
  arch: SupportedArch,
): `${SupportedPlatform}-${SupportedArch}` {
  return `${platform}-${arch}`;
}

export function resolveOwsNativeAddonPath(options: ResolveNativeAddonOptions = {}): string | undefined {
  const env = options.env ?? process.env;
  const explicitPath = env['MINDWALLET_OWS_NATIVE_PATH'];
  if (explicitPath) return explicitPath;

  const filename = getOwsNativeAddonFilename(options.platform ?? process.platform, options.arch ?? process.arch);
  if (!filename) return undefined;

  const execPath = options.execPath ?? process.execPath;
  const candidate = join(dirname(execPath), 'ows', filename);
  return (options.exists ?? existsSync)(candidate) ? candidate : undefined;
}
