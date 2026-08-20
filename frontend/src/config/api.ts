/**
 * Utility functions for API and Backend URL configuration.
 */

/**
 * Returns the normalized base backend URL (without trailing slash or /api/v1).
 * E.g., "http://localhost:5000"
 */
export function getBackendUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol || 'http:';

    // If accessing via network IP or custom domain (not literal localhost/127.0.0.1)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000`;
    }
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    let url = process.env.NEXT_PUBLIC_API_URL;
    url = url.replace(/\/+$/, '');
    url = url.replace(/\/api\/v1$/, '');
    return url;
  }

  return 'http://localhost:5000';
}

/**
 * Returns the normalized API v1 base URL.
 * E.g., "http://localhost:5000/api/v1" or "http://10.249.106.211:5000/api/v1"
 */
export function getApiUrl(): string {
  return `${getBackendUrl()}/api/v1`;
}
