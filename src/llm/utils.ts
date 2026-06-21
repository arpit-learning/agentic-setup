export function extractJson(text: string): string | null {
  const startIdx = text.search(/[[{]/);
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }

  return null;
}

export function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();
}

function isJsonObject(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

export function parseJsonResponse<T>(raw: string): T {
  // 1. Try to find a fenced ```json ... ``` block first
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (isJsonObject(parsed)) return parsed as T;
    } catch {
      // ignore and fall through
    }
  }

  // 2. Try parsing the entire cleaned string
  const cleaned = stripMarkdownFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (isJsonObject(parsed)) return parsed as T;
  } catch {
    // fall through to bracket extraction
  }

  // 3. Try to extract JSON from the first { or [ to the matching closing bracket
  // We'll search backwards so we get the LAST JSON block (which is usually the final answer)
  const lastIdx = cleaned.lastIndexOf('}');
  const firstIdx = cleaned.indexOf('{');
  if (lastIdx > firstIdx && firstIdx !== -1) {
    const substr = cleaned.slice(firstIdx, lastIdx + 1);
    try {
      const extracted = JSON.parse(substr);
      if (isJsonObject(extracted)) return extracted as T;
    } catch {
      // ignore
    }
  }

  const json = extractJson(cleaned);
  if (!json) {
    throw new Error(`No valid JSON object in LLM response: ${raw.slice(0, 200)}`);
  }

  try {
    const extracted = JSON.parse(json);
    if (!isJsonObject(extracted)) {
      throw new Error(`No valid JSON object in LLM response: ${raw.slice(0, 200)}`);
    }
    return extracted as T;
  } catch (err) {
    throw new Error(
      `JSON parse failed: ${(err as Error).message}. Output was: ${raw.slice(0, 200)}...`,
    );
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
