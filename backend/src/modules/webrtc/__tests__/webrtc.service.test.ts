import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WebRtcService, DEFAULT_STUN_URLS, IceServerConfig } from '../webrtc.service';
import { env } from '../../../config/env';

describe('WebRtcService', () => {
  const originalEnv = {
    TURN_PROVIDER: env.TURN_PROVIDER,
    CLOUDFLARE_TURN_KEY_ID: env.CLOUDFLARE_TURN_KEY_ID,
    CLOUDFLARE_TURN_API_TOKEN: env.CLOUDFLARE_TURN_API_TOKEN,
    WEBRTC_TURN_URL: env.WEBRTC_TURN_URL,
    WEBRTC_TURN_USERNAME: env.WEBRTC_TURN_USERNAME,
    WEBRTC_TURN_CREDENTIAL: env.WEBRTC_TURN_CREDENTIAL,
    WEBRTC_STUN_URL: env.WEBRTC_STUN_URL,
  };

  const MOCK_CF_ICE_SERVERS: IceServerConfig[] = [
    {
      urls: ['stun:stun.cloudflare.com:3478'],
    },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
      ],
      username: 'mock-cf-ephemeral-username',
      credential: 'mock-cf-ephemeral-credential',
    },
  ];

  beforeEach(() => {
    (env as any).TURN_PROVIDER = 'cloudflare';
    (env as any).CLOUDFLARE_TURN_KEY_ID = 'test-key-id-123';
    (env as any).CLOUDFLARE_TURN_API_TOKEN = 'test-token-xyz';
    (env as any).WEBRTC_TURN_URL = 'turn:relay.metered.ca:80,turn:relay.metered.ca:80?transport=tcp';
    (env as any).WEBRTC_TURN_USERNAME = 'metered-static-user';
    (env as any).WEBRTC_TURN_CREDENTIAL = 'metered-static-credential';
    (env as any).WEBRTC_STUN_URL = 'stun:stun.l.google.com:19302';
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
  });

  describe('Cloudflare Provider', () => {
    it('calls Cloudflare endpoint with correct parameters and returns augmented ICE servers in normal mode', async () => {
      let requestedUrl = '';
      let requestInit: RequestInit | undefined;

      const mockFetch: typeof fetch = async (input, init) => {
        requestedUrl = String(input);
        requestInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({ iceServers: MOCK_CF_ICE_SERVERS }),
        } as unknown as Response;
      };

      const service = new WebRtcService(mockFetch);
      const result = await service.getCloudflareIceServers(false);

      assert.equal(
        requestedUrl,
        'https://rtc.live.cloudflare.com/v1/turn/keys/test-key-id-123/credentials/generate-ice-servers'
      );
      assert.equal(requestInit?.method, 'POST');
      assert.deepEqual((requestInit?.headers as Record<string, string>)['Authorization'], 'Bearer test-token-xyz');
      assert.deepEqual(JSON.parse(String(requestInit?.body)), { ttl: 86400 });

      // Check that Cloudflare TURN servers are preserved
      const turnEntry = result.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn:turn.cloudflare.com'))
      );
      assert.ok(turnEntry, 'Expected Cloudflare TURN servers in result');
      assert.equal(turnEntry.username, 'mock-cf-ephemeral-username');

      // Check that Google STUN servers are preserved without duplicating Cloudflare STUN
      const stunEntries = result.filter((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('stun:'))
      );
      assert.ok(stunEntries.length >= 1, 'Expected STUN entries');
      const allUrls = result.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
      assert.ok(allUrls.includes('stun:stun.cloudflare.com:3478'));
      assert.ok(allUrls.includes('stun:stun.l.google.com:19302'));
    });

    it('returns only TURN servers when isTurnOnly is true', async () => {
      const mockFetch: typeof fetch = async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ iceServers: MOCK_CF_ICE_SERVERS }),
        } as unknown as Response);

      const service = new WebRtcService(mockFetch);
      const result = await service.getCloudflareIceServers(true);

      assert.ok(result.length > 0);
      for (const server of result) {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        assert.ok(
          urls.every((u) => u.startsWith('turn:') || u.startsWith('turns:')),
          `Expected only turn/turns URLs, got: ${urls.join(', ')}`
        );
      }
    });

    it('throws error when Cloudflare API responds with non-200 status and does NOT leak secret', async () => {
      const mockFetch: typeof fetch = async () =>
        ({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        } as unknown as Response);

      const service = new WebRtcService(mockFetch);

      await assert.rejects(
        async () => {
          await service.getCloudflareIceServers(false);
        },
        (err: Error) => {
          assert.match(err.message, /Cloudflare Realtime TURN API returned error status: 401/);
          assert.ok(!err.message.includes('test-token-xyz'), 'Secret token leaked in error message');
          return true;
        }
      );
    });

    it('fails fast and does not use Metered when TURN_PROVIDER=cloudflare and Cloudflare credentials are missing', async () => {
      (env as any).CLOUDFLARE_TURN_KEY_ID = '';
      (env as any).CLOUDFLARE_TURN_API_TOKEN = '';

      const service = new WebRtcService();

      await assert.rejects(
        async () => {
          await service.getIceServers(false);
        },
        /Cloudflare TURN credentials not configured/
      );
    });
  });

  describe('Metered Provider (Fallback / Rollback)', () => {
    it('returns Metered static credentials and STUN servers in normal mode', async () => {
      (env as any).TURN_PROVIDER = 'metered';
      const service = new WebRtcService();
      const result = await service.getIceServers(false);

      assert.ok(result.length >= 2);
      const stunEntry = result.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('stun:'))
      );
      assert.ok(stunEntry);

      const turnEntry = result.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn:relay.metered.ca'))
      );
      assert.ok(turnEntry);
      assert.equal(turnEntry?.username, 'metered-static-user');
      assert.equal(turnEntry?.credential, 'metered-static-credential');
    });

    it('returns only TURN servers when isTurnOnly is true', async () => {
      (env as any).TURN_PROVIDER = 'metered';
      const service = new WebRtcService();
      const result = await service.getIceServers(true);

      assert.equal(result.length, 1);
      const turnUrls = Array.isArray(result[0]!.urls) ? result[0]!.urls : [result[0]!.urls];
      assert.ok(turnUrls.every((u) => u.startsWith('turn:')));
    });
  });

  describe('Auto Provider Mode', () => {
    it('prefers Cloudflare when Cloudflare keys are present and fetch succeeds', async () => {
      (env as any).TURN_PROVIDER = 'auto';

      const mockFetch: typeof fetch = async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ iceServers: MOCK_CF_ICE_SERVERS }),
        } as unknown as Response);

      const service = new WebRtcService(mockFetch);
      const result = await service.getIceServers(false);

      const cfTurn = result.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn:turn.cloudflare.com'))
      );
      assert.ok(cfTurn, 'Expected Cloudflare TURN servers');
      assert.equal(cfTurn.username, 'mock-cf-ephemeral-username');
    });

    it('gracefully falls back to Metered when Cloudflare API fails in auto mode', async () => {
      (env as any).TURN_PROVIDER = 'auto';

      const mockFetch: typeof fetch = async () =>
        ({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as unknown as Response);

      const service = new WebRtcService(mockFetch);
      const result = await service.getIceServers(false);

      const meteredTurn = result.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn:relay.metered.ca'))
      );
      assert.ok(meteredTurn, 'Expected Metered TURN fallback');
      assert.equal(meteredTurn.username, 'metered-static-user');
    });

    it('directly uses Metered when Cloudflare keys are missing in auto mode', async () => {
      (env as any).TURN_PROVIDER = 'auto';
      (env as any).CLOUDFLARE_TURN_KEY_ID = '';
      (env as any).CLOUDFLARE_TURN_API_TOKEN = '';

      const service = new WebRtcService();
      const result = await service.getIceServers(false);

      const meteredTurn = result.find((s) =>
        Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn:relay.metered.ca'))
      );
      assert.ok(meteredTurn, 'Expected Metered TURN server');
    });
  });

  describe('Contract and Security Guarantee', () => {
    it('ensures returned iceServers structure adheres to standard format without extraneous secret fields', async () => {
      const mockFetch: typeof fetch = async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ iceServers: MOCK_CF_ICE_SERVERS }),
        } as unknown as Response);

      const service = new WebRtcService(mockFetch);
      const result = await service.getIceServers(false);

      for (const server of result) {
        assert.ok(server.urls, 'urls field must exist');
        const allowedKeys = new Set(['urls', 'username', 'credential']);
        for (const key of Object.keys(server)) {
          assert.ok(allowedKeys.has(key), `Unexpected key in ICE server config: ${key}`);
        }
      }
    });
  });
});
