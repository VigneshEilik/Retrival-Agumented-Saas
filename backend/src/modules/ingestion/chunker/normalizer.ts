export function normalizeText(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Unicode Normalization (Form KC)
      .normalize('NFKC')
      // Standardize Windows/Mac newlines to \n
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove null bytes and non-printable control characters except \n and \t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Trim excessive consecutive blank lines (max 2 consecutive newlines)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
