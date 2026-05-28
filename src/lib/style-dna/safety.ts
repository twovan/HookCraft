const BLOCKED_NAME_PATTERNS = [
  /\blike\s+[A-Z][A-Za-z0-9.' -]{1,40}/g,
  /\bin the style of\s+[A-Z][A-Za-z0-9.' -]{1,40}/gi,
  /\bsimilar to\s+[A-Z][A-Za-z0-9.' -]{1,40}/gi,
  /\b[a-z]+core\s+version of\s+[A-Z][A-Za-z0-9.' -]{1,40}/gi,
  /\bJay Chou\b/gi,
  /\bTaylor Swift\b/gi,
];

export function sanitizeCopyrightUnsafeText(input: string): string {
  let output = input;
  for (const pattern of BLOCKED_NAME_PATTERNS) {
    output = output.replace(pattern, 'copyright-safe broad musical traits');
  }
  return output.replace(/\s+/g, ' ').trim();
}

