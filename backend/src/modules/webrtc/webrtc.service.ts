import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CloudflareIceServerResponse {
  iceServers?: IceServerConfig[];
}

export const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stun.services.mozilla.com',
];

export class WebRtcService {
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = fetch) {
    this.fetchFn = fetchFn;
  }

  /**
   * Returns standard STUN URLs including any custom WEBRTC_STUN_URL.
   */
  public getStandardStunUrls(): string[] {
    const urls = [...DEFAULT_STUN_URLS];
    if (env.WEBRTC_STUN_URL && !urls.includes(env.WEBRTC_STUN_URL)) {
      urls.push(env.WEBRTC_STUN_URL);
    }
    return urls;
  }

  /**
   * Generates or fetches ICE servers based on configured TURN_PROVIDER.
   */
  public async getIceServers(isTurnOnly = false): Promise<IceServerConfig[]> {
    const provider = env.TURN_PROVIDER;

    switch (provider) {
      case 'cloudflare':
        return this.getCloudflareIceServers(isTurnOnly);

      case 'auto':
        return this.getAutoIceServers(isTurnOnly);

      case 'metered':
      default:
        return this.getMeteredIceServers(isTurnOnly);
    }
  }

  /**
   * Fetches ephemeral TURN/STUN credentials from Cloudflare Realtime TURN API.
   * Endpoint: POST https://rtc.live.cloudflare.com/v1/turn/keys/{KEY_ID}/credentials/generate-ice-servers
   */
  public async getCloudflareIceServers(isTurnOnly = false): Promise<IceServerConfig[]> {
    const keyId = env.CLOUDFLARE_TURN_KEY_ID;
    const apiToken = env.CLOUDFLARE_TURN_API_TOKEN;

    if (!keyId || !apiToken) {
      throw new Error('Cloudflare TURN credentials not configured (CLOUDFLARE_TURN_KEY_ID or CLOUDFLARE_TURN_API_TOKEN missing)');
    }

    const endpoint = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`;

    const response = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare Realtime TURN API returned error status: ${response.status}`);
    }

    const data = (await response.json()) as CloudflareIceServerResponse;

    if (!data || !Array.isArray(data.iceServers) || data.iceServers.length === 0) {
      throw new Error('Cloudflare Realtime TURN API returned invalid or empty iceServers payload');
    }

    const rawServers = data.iceServers;

    if (isTurnOnly) {
      // Filter strictly for TURN relay servers (turn: or turns:)
      const turnServers: IceServerConfig[] = [];

      for (const server of rawServers) {
        const urlList = Array.isArray(server.urls) ? server.urls : [server.urls];
        const turnUrls = urlList.filter((u) => u.startsWith('turn:') || u.startsWith('turns:'));
        if (turnUrls.length > 0) {
          turnServers.push({
            urls: turnUrls,
            ...(server.username ? { username: server.username } : {}),
            ...(server.credential ? { credential: server.credential } : {}),
          });
        }
      }

      // If TURN servers found, return them; otherwise fallback to full raw list
      return turnServers.length > 0 ? turnServers : rawServers;
    }

    // Normal mode: preserve Cloudflare's returned servers and supplement with Google STUN without duplicate STUN entries
    const existingStunUrls = new Set<string>();
    for (const server of rawServers) {
      const urlList = Array.isArray(server.urls) ? server.urls : [server.urls];
      for (const u of urlList) {
        if (u.startsWith('stun:')) {
          existingStunUrls.add(u);
        }
      }
    }

    const standardStuns = this.getStandardStunUrls();
    const additionalStunUrls = standardStuns.filter((u) => !existingStunUrls.has(u));

    const result: IceServerConfig[] = [...rawServers];
    if (additionalStunUrls.length > 0) {
      result.unshift({ urls: additionalStunUrls });
    }

    return result;
  }

  /**
   * Generates ICE servers using existing Metered configuration (rollback/fallback support).
   */
  public getMeteredIceServers(isTurnOnly = false): IceServerConfig[] {
    const stunUrls = this.getStandardStunUrls();
    const iceServers: IceServerConfig[] = [];

    if (!isTurnOnly) {
      iceServers.push({ urls: stunUrls });
    }

    if (env.WEBRTC_TURN_URL && env.WEBRTC_TURN_URL.trim().length > 0) {
      const turnUrls = env.WEBRTC_TURN_URL.split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      const turnEntry: IceServerConfig = {
        urls: turnUrls,
      };

      if (env.WEBRTC_TURN_USERNAME) {
        turnEntry.username = env.WEBRTC_TURN_USERNAME;
      }
      if (env.WEBRTC_TURN_CREDENTIAL) {
        turnEntry.credential = env.WEBRTC_TURN_CREDENTIAL;
      }

      iceServers.push(turnEntry);
    } else if (isTurnOnly) {
      // Fallback if TURN is forced but TURN config is missing: keep STUN
      iceServers.push({ urls: stunUrls });
    }

    return iceServers;
  }

  /**
   * Handles 'auto' provider mode: prefers Cloudflare if keys exist, with graceful fallback to Metered.
   */
  private async getAutoIceServers(isTurnOnly = false): Promise<IceServerConfig[]> {
    const hasCloudflareKeys = Boolean(env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN);

    if (hasCloudflareKeys) {
      try {
        return await this.getCloudflareIceServers(isTurnOnly);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logger.warn(`[WebRTC] Cloudflare Realtime TURN failed in auto mode, falling back to Metered: ${errorMsg}`);
      }
    } else {
      logger.info('[WebRTC] Cloudflare TURN keys not configured in auto mode, using Metered provider');
    }

    return this.getMeteredIceServers(isTurnOnly);
  }
}

export const webRtcService = new WebRtcService();
