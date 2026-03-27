import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const buildLockDir = join(repoRoot, 'packages', 'cli', '.build-lock');
const cliPackageJsonPath = join(repoRoot, 'packages', 'cli', 'package.json');
const cliPackageJson = JSON.parse(readFileSync(cliPackageJsonPath, 'utf8'));

const targetMap = {
  'darwin-arm64': {
    bunTarget: 'bun-darwin-arm64',
    addonPackageDir: '@open-wallet-standard/core-darwin-arm64',
    addonFilename: 'ows-node.darwin-arm64.node',
  },
  'darwin-x64': {
    bunTarget: 'bun-darwin-x64',
    addonPackageDir: '@open-wallet-standard/core-darwin-x64',
    addonFilename: 'ows-node.darwin-x64.node',
  },
  'linux-x64': {
    bunTarget: 'bun-linux-x64',
    addonPackageDir: '@open-wallet-standard/core-linux-x64-gnu',
    addonFilename: 'ows-node.linux-x64-gnu.node',
  },
  'linux-arm64': {
    bunTarget: 'bun-linux-arm64',
    addonPackageDir: '@open-wallet-standard/core-linux-arm64-gnu',
    addonFilename: 'ows-node.linux-arm64-gnu.node',
  },
};

const target = parseTarget(process.argv.slice(2));
const config = targetMap[target];
if (!config) {
  throw new Error(`Unsupported target: ${target}`);
}

const outDir = join(repoRoot, 'dist', 'native', target);
const binaryPath = join(outDir, 'mindpass');
const addonOutDir = join(outDir, 'ows');
const addonSourcePath = join(repoRoot, 'node_modules', ...config.addonPackageDir.split('/'), config.addonFilename);

if (!existsSync(addonSourcePath)) {
  throw new Error(
    `Missing OWS addon for ${target} at ${addonSourcePath}. Install dependencies for that target before building.`,
  );
}

await withBuildLock(async () => {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(addonOutDir, { recursive: true });

  for (const pkg of ['@mindpass/core', '@mindpass/protocols', '@mindpass/discovery', 'mindpass-cli']) {
    execFileSync(
      'bun',
      ['run', '--filter', pkg, 'build'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        env: process.env,
      },
    );
  }

  execFileSync(
    'bun',
    [
      'build',
      '--compile',
      `--target=${config.bunTarget}`,
      '--define',
      `__MINDPASS_VERSION__=${JSON.stringify(cliPackageJson.version)}`,
      'packages/cli/dist/cli.js',
      '--outfile',
      binaryPath,
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        MINDPASS_VERSION: cliPackageJson.version,
      },
    },
  );
});

cpSync(addonSourcePath, join(addonOutDir, config.addonFilename));

writeFileSync(
  join(outDir, 'metadata.json'),
  JSON.stringify(
    {
      name: 'mindpass',
      version: cliPackageJson.version,
      target,
      bunTarget: config.bunTarget,
      binary: 'mindpass',
      addon: join('ows', config.addonFilename),
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

function parseTarget(argv) {
  const idx = argv.indexOf('--target');
  if (idx >= 0) {
    const value = argv[idx + 1];
    if (!value) throw new Error('Missing value for --target');
    return value;
  }

  const platform = process.platform;
  const arch = process.arch;
  if ((platform === 'darwin' || platform === 'linux') && (arch === 'arm64' || arch === 'x64')) {
    return `${platform}-${arch}`;
  }

  throw new Error(`Unsupported host platform for default target: ${platform}-${arch}`);
}

async function withBuildLock(fn) {
  while (true) {
    try {
      mkdirSync(buildLockDir);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      await sleep(100);
    }
  }

  try {
    return await fn();
  } finally {
    rmSync(buildLockDir, { recursive: true, force: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
