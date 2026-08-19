const KEY = "ntorrent-web-ui-token";

export function getStoredToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(KEY);
}

/** Fired when a request comes back 401, so the app can drop to the login screen. */
export const UNAUTHORIZED_EVENT = "ntorrent:unauthorized";

export function notifyUnauthorized() {
  clearStoredToken();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
