# Windows support

Windows is a first-class runtime, not a best-effort port.

## What is covered

- `cmd.exe` and PowerShell argument quoting (`packages/runtime/src/windows.ts`)
- Executable resolution for `.exe` / `.cmd` / `.bat`
- CRLF fixtures and Unicode workspace paths
- System proxy inheritance via `HTTP_PROXY` / `HTTPS_PROXY` and the Windows registry (`proxy.ts`)
- `windowsHide: true` on spawned Grok processes

## Known limitations

- PAC/auto-config proxy URLs are detected but not forwarded; set `HTTPS_PROXY` explicitly.
- Named-pipe `stdio` can fail with `EPERM` in some sandboxes; headless mode falls back to file redirection.
- ConPTY/PTY interactive sessions are not implemented in v0.1; use headless or ACP stdio.

## CI

Quality jobs run on `windows-latest` as well as Ubuntu and macOS. Runtime tests include quoting, path, and newline cases that execute on every OS.
