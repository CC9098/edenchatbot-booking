const REDACTION_PATTERNS: RegExp[] = [
  /("?(?:refresh_token|access_token|client_secret|id_token)"?\s*:\s*")([^"]+)(")/gi,
  /((?:refresh_token|access_token|client_secret|id_token)\s*[=:]\s*)([^&\s,'"]+)/gi,
  /(Authorization:\s*Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/gi,
  /('(?:refresh_token|access_token|client_secret|id_token)'\s*=>\s*')([^']+)(')/gi,
];

function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of REDACTION_PATTERNS) {
    output = output.replace(pattern, '$1[REDACTED]$3');
  }
  return output;
}

function serializeErrorData(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getSafeErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (!error) return fallback;

  if (typeof error === 'string') {
    const text = error.trim();
    return text ? redactSecrets(text) : fallback;
  }

  if (error instanceof Error) {
    const name = error.name || 'Error';
    const message = error.message || fallback;
    return redactSecrets(`${name}: ${message}`);
  }

  if (typeof error === 'object') {
    const row = error as Record<string, unknown>;
    const parts: string[] = [];

    const message = serializeErrorData(row.message);
    if (message) parts.push(message);

    const code = serializeErrorData(row.code);
    if (code) parts.push(`code=${code}`);

    const status = serializeErrorData(row.status);
    if (status) parts.push(`status=${status}`);

    const causeMessage = serializeErrorData((row.cause as Record<string, unknown> | undefined)?.message);
    if (causeMessage) parts.push(`cause=${causeMessage}`);

    const responseData = serializeErrorData(
      ((row.response as Record<string, unknown> | undefined)?.data)
    );
    if (responseData) parts.push(`response=${responseData}`);

    if (parts.length > 0) {
      return redactSecrets(parts.join(' | '));
    }
  }

  return redactSecrets(String(error));
}

