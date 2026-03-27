class Mindpass < Formula
  desc "Agent payment wallet CLI for HTTP 402 and MCP flows"
  homepage "https://github.com/remyjkim/mindpass"
  url ENV.fetch("MINDPASS_FORMULA_URL", "https://github.com/remyjkim/mindpass/archive/refs/tags/v0.0.0.tar.gz")
  sha256 ENV.fetch("MINDPASS_FORMULA_SHA256", "0000000000000000000000000000000000000000000000000000000000000000")
  license "MIT"

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

    libexec.install "dist/native/#{target}/mindpass"
    (libexec/"ows").install Dir["dist/native/#{target}/ows/*.node"]

    addon_path = Dir[libexec/"ows/*.node"].first
    odie "OWS native addon missing after build" unless addon_path

    (bin/"mindpass").write_env_script libexec/"mindpass",
      MINDPASS_OWS_NATIVE_PATH: addon_path
  end

  test do
    assert_match(version.to_s, shell_output("#{bin}/mindpass --version"))
    assert_match("Usage:", shell_output("#{bin}/mindpass help"))
  end
end
