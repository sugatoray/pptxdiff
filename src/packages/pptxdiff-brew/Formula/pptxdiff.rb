class Pptxdiff < Formula
  desc "Local-first PowerPoint (.pptx) deck diff tool with CLI and browser UI"
  homepage "https://github.com/sugatoray/pptxdiff"
  url "https://registry.npmjs.org/pptxdiff/-/pptxdiff-0.8.0.tgz"
  sha256 "6bfcb3535d7c9ea3baacbf7e0e506c52fe63c91f00b692f1928eeb5e21e5c35f"
  license "Apache-2.0"

  livecheck do
    url :stable
    strategy :npm
  end

  depends_on "node"

  def install
    # The published tarball has zero runtime "dependencies" (only devDependencies
    # used to build/test this repo) — every third-party library it needs
    # (React, JSZip, pptx-renderer, ...) is already vendored under
    # src/pptxdiff/vendor. `npm install` here only links the package itself,
    # no network fetch of runtime deps is required.
    system "npm", "install", *std_npm_args(prefix: libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  def caveats
    <<~EOS
      `pptxdiff` starts a local static server on a random loopback port and
      opens your default browser at that URL. Nothing is uploaded anywhere —
      the diff runs entirely client-side in the browser tab it opens.

      Press Ctrl-C in the terminal to stop the server.
    EOS
  end

  test do
    require "timeout"

    # `pptxdiff` binds to an OS-assigned loopback port and prints
    # "pptxdiff running at http://localhost:<port>" once ready, then tries
    # (best-effort) to open a browser — it never exits on its own, so read
    # its first stdout line to recover the real port instead of guessing one.
    io = IO.popen([bin/"pptxdiff"], err: [:child, :out])
    line = Timeout.timeout(15) { io.readline }
    url = line[%r{http://localhost:\d+}]
    assert url, "did not find a server URL in pptxdiff's startup output: #{line.inspect}"

    sleep 1
    assert_match "<html", shell_output("curl -sf --max-time 5 #{url}")
  ensure
    if io
      Process.kill("TERM", io.pid)
      begin
        Process.wait(io.pid)
      rescue Errno::ECHILD
        nil
      end
    end
  end
end
