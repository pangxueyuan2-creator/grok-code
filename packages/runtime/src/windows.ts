/**
 * Windows-first process helpers. Quoting is explicit because cmd.exe, PowerShell
 * and POSIX shells disagree about metacharacters and Unicode paths.
 */

export type WindowsShell = "cmd" | "powershell" | "posix";

export function detectShell(platform: NodeJS.Platform = process.platform, env = process.env): WindowsShell {
  if (platform !== "win32") return "posix";
  const comspec = (env["ComSpec"] ?? env["COMSPEC"] ?? "").toLowerCase();
  if (comspec.endsWith("powershell.exe") || env["PSModulePath"]) return "powershell";
  return "cmd";
}

/** Quote a single argument for cmd.exe. */
export function quoteCmd(arg: string): string {
  if (arg.length === 0) return '""';
  if (!/[ \t&()[\]{}^=;!'+,`~%]/.test(arg) && !arg.includes('"')) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/** Quote a single argument for PowerShell. */
export function quotePowerShell(arg: string): string {
  return `'${arg.replace(/'/g, "''")}'`;
}

export function quotePosix(arg: string): string {
  if (arg.length === 0) return "''";
  if (!/[^A-Za-z0-9_./:=+-]/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function quoteForShell(arg: string, shell: WindowsShell): string {
  switch (shell) {
    case "cmd":
      return quoteCmd(arg);
    case "powershell":
      return quotePowerShell(arg);
    case "posix":
      return quotePosix(arg);
  }
}

export function quoteArgs(args: readonly string[], shell: WindowsShell): string[] {
  return args.map((arg) => quoteForShell(arg, shell));
}

/** Resolve .cmd / .exe / extension-less names the way cmd.exe does. */
export function windowsExecutableCandidates(name: string): string[] {
  if (/\.(exe|cmd|bat|com)$/i.test(name)) return [name];
  return [`${name}.exe`, `${name}.cmd`, `${name}.bat`, name];
}

export function normalizeNewlines(text: string, style: "lf" | "crlf"): string {
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return style === "crlf" ? lf.replace(/\n/g, "\r\n") : lf;
}

export function isUncPath(path: string): boolean {
  return path.startsWith("\\\\") || path.startsWith("//");
}
