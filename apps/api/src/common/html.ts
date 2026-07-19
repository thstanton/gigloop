/**
 * HTML escaping for values interpolated into outbound email bodies.
 *
 * #691: portal notification emails are assembled as plain text and shipped as
 * `html`. Fields on that path come from the *unauthenticated* portal submit, so
 * anything unescaped is an HTML-injection / phishing vector into the musician's
 * inbox. Escape at the plain-text → HTML boundary rather than per field, so a
 * newly added field cannot silently miss it.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert a plain-text email body to HTML. Escaping must happen *before* the
 * newline substitution, or the `<br>` tags this inserts would be escaped too.
 */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
