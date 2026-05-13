const VERIFIER_KEY = 'pkce_verifier'

function generateRandom(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(plain))
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function generateChallenge(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandom(64)
  const hashed = await sha256(verifier)
  const challenge = base64url(hashed)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  return { verifier, challenge }
}

export function getStoredVerifier(): string | null {
  return sessionStorage.getItem(VERIFIER_KEY)
}

export function clearVerifier(): void {
  sessionStorage.removeItem(VERIFIER_KEY)
}
