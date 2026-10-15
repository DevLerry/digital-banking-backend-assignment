/**
 * Where the JWT lives in the browser.
 *
 * We use localStorage, and it is worth understanding the trade-off rather than
 * copying it blindly:
 *
 *   localStorage  — survives refresh and closing the tab. Readable by ANY
 *                   JavaScript on the page, so a successful XSS attack can
 *                   steal the token.
 *   memory only   — immune to token theft via XSS, but the user is logged out
 *                   every single refresh. Unacceptable for a banking dashboard.
 *   httpOnly cookie — the genuinely secure option: JavaScript cannot read it at
 *                   all. Requires backend changes (Set-Cookie, CSRF protection)
 *                   which are out of scope for this project.
 *
 * We choose localStorage knowingly, and mitigate the real risk by never
 * rendering untrusted HTML — React escapes everything by default, so as long as
 * we avoid dangerouslySetInnerHTML there is no XSS vector to exploit.
 */

const TOKEN_KEY = 'ourbank.token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null; // private browsing can throw
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore — the app still works for this session */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};
