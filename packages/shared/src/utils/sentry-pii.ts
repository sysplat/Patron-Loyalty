const SENSITIVE_KEY =
  /password|secret|token|authorization|cookie|api[_-]?key|customerphone|customer_phone|phone|email|ssn|credit/i;

/** Deep-clone and redact obvious PII/credential keys for observability payloads. */
export function scrubSensitiveRecord<T>(value: T): T {
  return scrubValue(value, 0) as T;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > 8) return '[Truncated]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[Redacted]';
    } else {
      out[key] = scrubValue(child, depth + 1);
    }
  }
  return out;
}
