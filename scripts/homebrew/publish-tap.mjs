import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const tapPath = resolve(args.tapPath ?? process.env['MINDWALLET_TAP_PATH'] ?? '');

if (!tapPath) {
  throw new Error('Provide --tap-path or set MINDWALLET_TAP_PATH');
}

const formulaDir = join(tapPath, 'Formula');
mkdirSync(formulaDir, { recursive: true });

const formula = renderFormula({
  version: args.version,
  url: args.url,
  sha256: args.sha256,
});

writeFileSync(join(formulaDir, 'mindwallet.rb'), formula, 'utf8');

const readmeSource = join(repoRoot, 'packaging', 'homebrew', 'README.md');
copyFileSync(readmeSource, join(tapPath, 'README.md'));

function parseArgs(argv) {
  const read = (flag) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const version = read('--version');
  const url = read('--url');
  const sha256 = read('--sha256');
  const tapPath = read('--tap-path');

  if (!version || !url || !sha256) {
    throw new Error('Usage: node scripts/homebrew/publish-tap.mjs --version <v> --url <url> --sha256 <sha> [--tap-path <path>]');
  }

  return { version, url, sha256, tapPath };
}

function renderFormula({ version, url, sha256 }) {
  return `class Mindwallet < Formula
  desc "Agent payment wallet CLI for HTTP 402 and MCP flows"
  homepage "https://github.com/remyjkim/mind-wallet"
  url "${url}"
  sha256 "${sha256}"
  license "MIT"
  version "${version}"

  depends_on "oven-sh/bun/bun" => :build

  def install
    system "bun", "install", "--frozen-lockfile"

    target =
      if OS.mac?
        Hardware::CPU.arm? ? "darwin-arm64" : "darwin-x64"
      elsif OS.linux?
        Hardware::CPU.arm? ? "linux-arm64" : "linux-x64"
      else
        odie "Unsupported platform"
      end

    system "bun", "run", "native:build", "--target", target

    libexec.install "dist/native/#{target}/mindwallet"
    (libexec/"ows").install Dir["dist/native/#{target}/ows/*.node"]

    addon_path = Dir[libexec/"ows/*.node"].first
    odie "OWS native addon missing after build" unless addon_path

    (bin/"mindwallet").write_env_script libexec/"mindwallet",
      MINDWALLET_OWS_NATIVE_PATH: addon_path
  end

  test do
    assert_match(version.to_s, shell_output("#{bin}/mindwallet --version"))
    assert_match("Usage:", shell_output("#{bin}/mindwallet help"))
  end
end
`;
}
