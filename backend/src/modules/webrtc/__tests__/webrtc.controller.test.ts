import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WebRtcController } from '../webrtc.controller';
import { webRtcService } from '../webrtc.service';
import type { Request, Response } from 'express';

describe('WebRtcController', () => {
  it('returns HTTP 200 with the exact expected response contract', async () => {
    const originalGetIceServers = webRtcService.getIceServers;
    webRtcService.getIceServers = async (isTurnOnly: boolean) => [
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
        username: 'test-user',
        credential: 'test-pass',
      },
    ];

    try {
      const controller = new WebRtcController();

      let statusCode = 0;
      let jsonPayload: any = null;

      const mockReq = {
        query: {},
      } as unknown as Request;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonPayload = data;
          return mockRes;
        },
      } as unknown as Response;

      await controller.getIceConfig(mockReq, mockRes);

      assert.equal(statusCode, 200);
      assert.equal(jsonPayload.success, true);
      assert.equal(jsonPayload.data.isTurnOnlyMode, false);
      assert.ok(Array.isArray(jsonPayload.data.iceServers));
      assert.equal(jsonPayload.data.iceServers.length, 2);
    } finally {
      webRtcService.getIceServers = originalGetIceServers;
    }
  });

  it('correctly handles turnOnly=true and reports isTurnOnlyMode: true', async () => {
    const originalGetIceServers = webRtcService.getIceServers;
    webRtcService.getIceServers = async (isTurnOnly: boolean) => {
      assert.equal(isTurnOnly, true);
      return [
        {
          urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
          username: 'test-user',
          credential: 'test-pass',
        },
      ];
    };

    try {
      const controller = new WebRtcController();

      let statusCode = 0;
      let jsonPayload: any = null;

      const mockReq = {
        query: { turnOnly: 'true' },
      } as unknown as Request;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonPayload = data;
          return mockRes;
        },
      } as unknown as Response;

      await controller.getIceConfig(mockReq, mockRes);

      assert.equal(statusCode, 200);
      assert.equal(jsonPayload.success, true);
      assert.equal(jsonPayload.data.isTurnOnlyMode, true);
      assert.equal(jsonPayload.data.iceServers.length, 1);
    } finally {
      webRtcService.getIceServers = originalGetIceServers;
    }
  });

  it('returns HTTP 500 when service throws without leaking error details', async () => {
    const originalGetIceServers = webRtcService.getIceServers;
    webRtcService.getIceServers = async () => {
      throw new Error('Sensitive internal error with secret_api_token_123');
    };

    try {
      const controller = new WebRtcController();

      let statusCode = 0;
      let jsonPayload: any = null;

      const mockReq = {
        query: {},
      } as unknown as Request;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          jsonPayload = data;
          return mockRes;
        },
      } as unknown as Response;

      await controller.getIceConfig(mockReq, mockRes);

      assert.equal(statusCode, 500);
      assert.equal(jsonPayload.success, false);
      assert.equal(jsonPayload.message, 'Failed to retrieve WebRTC ICE configuration');
      assert.ok(!JSON.stringify(jsonPayload).includes('secret_api_token_123'));
    } finally {
      webRtcService.getIceServers = originalGetIceServers;
    }
  });
});
