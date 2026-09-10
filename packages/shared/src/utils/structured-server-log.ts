/**
 * Structured one-line JSON logs for Node server runtimes (API-style fields for Better Stack).
 * Safe to call multiple times; no-ops in test / pretty / browser.
 */

let installedFor: string | null = null;

/** Test-only: allow re-install after restoring console. */
export function resetStructuredServerLogsForTests(): void {
  installedFor = null;
}

export function shouldUseStructuredServerLogs(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'test') return false;
  const format = (env.LOG_FORMAT || '').trim().toLowerCase();
  if (format === 'json') return true;
  if (format === 'pretty') return false;
  return env.NODE_ENV === 'production';
}

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return { message: arg.message, name: arg.name, stack: arg.stack };
  }
  if (typeof arg === 'string') {
    const trimmed = arg.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed) as unknown;
      } catch {
        return arg;
      }
    }
    return arg;
  }
  return arg;
}

function writeLine(service: string, level: string, args: unknown[]): void {
  const base: Record<string, unknown> = { level, service };
  if (args.length === 1) {
    const only = serializeArg(args[0]);
    if (only && typeof only === 'object' && !Array.isArray(only) && !(only instanceof Error)) {
      const obj = only as Record<string, unknown>;
      process.stdout.write(
        `${JSON.stringify({
          ...base,
          ...obj,
          message: typeof obj.message === 'string' ? obj.message : undefined,
        })}\n`,
      );
      return;
    }
    if (typeof only === 'object' && only !== null && 'message' in (only as object)) {
      const err = only as { message?: string; name?: string; stack?: string };
      process.stdout.write(
        `${JSON.stringify({
          ...base,
          message: err.message,
          errorName: err.name,
          stack: err.stack,
        })}\n`,
      );
      return;
    }
    process.stdout.write(`${JSON.stringify({ ...base, message: only })}\n`);
    return;
  }

  process.stdout.write(
    `${JSON.stringify({
      ...base,
      message: args.map((a) => (typeof a === 'string' ? a : serializeArg(a))),
    })}\n`,
  );
}

/**
 * Replace console.log/info/warn/error/debug with JSON lines tagged by `service`.
 */
export function installStructuredServerLogs(service: string): void {
  if (typeof process === 'undefined' || typeof console === 'undefined') return;
  if (!shouldUseStructuredServerLogs()) return;
  if (installedFor === service) return;
  installedFor = service;

  const wrap =
    (level: string) =>
    (...args: unknown[]) => {
      writeLine(service, level, args);
    };

  console.log = wrap('info');
  console.info = wrap('info');
  console.warn = wrap('warn');
  console.error = wrap('error');
  console.debug = wrap('debug');
}
