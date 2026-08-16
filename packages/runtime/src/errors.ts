export class GrokCodeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GrokCodeError";
  }
}

export class GrokNotFoundError extends GrokCodeError {
  constructor(details?: Record<string, unknown>) {
    super(
      "找不到 Grok Build。请先安装 grok CLI（https://x.ai/cli），或设置 GROK_PATH 指向 grok 可执行文件。",
      "GROK_NOT_FOUND",
      details,
    );
  }
}

export class GrokRunError extends GrokCodeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "GROK_RUN_ERROR", details);
  }
}

export class GrokTimeoutError extends GrokCodeError {
  constructor(timeoutMs: number, details?: Record<string, unknown>) {
    super(
      `Grok 在 ${Math.round(timeoutMs / 1000)} 秒内没有完成（可能仍在思考或等待登录）。`,
      "GROK_TIMEOUT",
      details,
    );
  }
}
