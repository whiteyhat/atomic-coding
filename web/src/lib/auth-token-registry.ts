let getAuthTokenFn: (() => Promise<string | null>) | null = null;

export function registerAuthTokenGetter(fn: () => Promise<string | null>) {
  getAuthTokenFn = fn;
}

export function getAuthTokenGetter() {
  return getAuthTokenFn;
}
