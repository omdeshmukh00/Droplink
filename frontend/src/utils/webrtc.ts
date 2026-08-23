import axios from 'axios';
import { getApiUrl } from '../config/api';

export const DEFAULT_STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let cachedIceConfig: RTCConfiguration | null = null;

/**
 * Fetches WebRTC ICE/TURN configuration from backend server.
 * Falls back to DEFAULT_STUN_CONFIG if fetching fails or times out.
 */
export async function fetchIceConfiguration(): Promise<RTCConfiguration> {
  if (cachedIceConfig) {
    return cachedIceConfig;
  }

  try {
    const apiUrl = getApiUrl();
    const response = await axios.get<{
      success: boolean;
      data?: { iceServers?: RTCIceServer[] };
    }>(`${apiUrl}/webrtc/config`, { timeout: 4000 });

    if (response.data?.success && Array.isArray(response.data?.data?.iceServers)) {
      cachedIceConfig = { iceServers: response.data.data.iceServers };
      console.log('[WebRTC] Successfully fetched ICE/TURN configuration from backend server.');
      return cachedIceConfig;
    }
  } catch (err) {
    console.warn('[WebRTC] Failed to fetch server ICE config, falling back to DEFAULT_STUN_CONFIG:', err);
  }

  return DEFAULT_STUN_CONFIG;
}

export const CHUNK_SIZE = 16384; // 16KB per chunk

export interface WebRTCTransferProgress {
  fileId: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export type WebRTCConnectionStateCallback = (state: RTCPeerConnectionState) => void;

export class WebRTCPeerManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onStateChangeCb: WebRTCConnectionStateCallback | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  constructor(config?: RTCConfiguration) {
    if (typeof window !== 'undefined') {
      this.peerConnection = new RTCPeerConnection(config || DEFAULT_STUN_CONFIG);
      this.setupConnectionListeners();
    }
  }

  public static async create(config?: RTCConfiguration): Promise<WebRTCPeerManager> {
    const iceConfig = config || (await fetchIceConfiguration());
    return new WebRTCPeerManager(iceConfig);
  }

  private setupConnectionListeners(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        console.log(`[WebRTC] connectionState -> ${state}`);
        if (state === 'connected') {
          this.logSelectedCandidatePair();
        }
        if (this.onStateChangeCb) {
          this.onStateChangeCb(state);
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WebRTC] iceConnectionState -> ${this.peerConnection.iceConnectionState}`);
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WebRTC] iceGatheringState -> ${this.peerConnection.iceGatheringState}`);
      }
    };

    this.peerConnection.onsignalingstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WebRTC] signalingState -> ${this.peerConnection.signalingState}`);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type || 'unknown';
        const protocol = event.candidate.protocol || 'unknown';
        console.log(`[WebRTC] Local ICE candidate gathered: type=${type}, protocol=${protocol}`);
      }
    };
  }

  private async logSelectedCandidatePair(): Promise<void> {
    if (!this.peerConnection) return;
    try {
      const stats = await this.peerConnection.getStats();
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const localCand = stats.get(report.localCandidateId);
          const remoteCand = stats.get(report.remoteCandidateId);
          console.log(
            `[WebRTC] Selected Candidate Pair: Local (${localCand?.candidateType || 'unknown'}, ${localCand?.protocol || 'unknown'}) <-> Remote (${remoteCand?.candidateType || 'unknown'}, ${remoteCand?.protocol || 'unknown'})`
          );
        }
      });
    } catch (err) {
      console.warn('[WebRTC] Error retrieving stats for candidate pair:', err);
    }
  }

  public onConnectionStateChange(cb: WebRTCConnectionStateCallback): void {
    this.onStateChangeCb = cb;
  }

  public getPeerConnection(): RTCPeerConnection {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection is not initialized');
    }
    return this.peerConnection;
  }

  public async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('RTCPeerConnection is not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    await this.processBufferedIceCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to add ICE candidate:', err);
      }
    } else {
      const isDuplicate = this.iceCandidateQueue.some(
        (c) =>
          c.candidate === candidate.candidate &&
          c.sdpMid === candidate.sdpMid &&
          c.sdpMLineIndex === candidate.sdpMLineIndex
      );
      if (!isDuplicate) {
        console.log('[WebRTC] Remote description not set yet. Queuing ICE candidate.');
        this.iceCandidateQueue.push(candidate);
      }
    }
  }

  public async processBufferedIceCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    const candidates = [...this.iceCandidateQueue];
    this.iceCandidateQueue = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to add queued ICE candidate:', err);
      }
    }
  }

  public createDataChannel(label = 'fileTransfer'): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('Peer Connection not available');
    }
    this.dataChannel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });
    this.dataChannel.binaryType = 'arraybuffer';
    this.attachDataChannelListeners(this.dataChannel);
    return this.dataChannel;
  }

  public setDataChannel(dc: RTCDataChannel): void {
    this.dataChannel = dc;
    this.dataChannel.binaryType = 'arraybuffer';
    this.attachDataChannelListeners(this.dataChannel);
  }

  private attachDataChannelListeners(dc: RTCDataChannel): void {
    dc.addEventListener('open', () =>
      console.log(`[WebRTC DataChannel] state -> open (label: ${dc.label})`)
    );
    dc.addEventListener('close', () =>
      console.log(`[WebRTC DataChannel] state -> closed (label: ${dc.label})`)
    );
    dc.addEventListener('error', (err) =>
      console.error(`[WebRTC DataChannel] error (label: ${dc.label}):`, err)
    );
  }

  public getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  /**
   * Sends a File over DataChannel in 16KB chunks with backpressure handling.
   */
  public async sendFile(
    file: File,
    fileId: string,
    onProgress?: (progress: WebRTCTransferProgress) => void,
    extraMetadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }

    const channel = this.dataChannel;
    channel.bufferedAmountLowThreshold = 65536; // 64KB threshold for backpressure

    // Send metadata header first
    const header = JSON.stringify({
      type: 'header',
      fileId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      ...extraMetadata,
    });
    channel.send(header);

    let offset = 0;
    const totalSize = file.size;

    if (totalSize === 0 && onProgress) {
      onProgress({
        fileId,
        fileName: file.name,
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 100,
      });
    }

    while (offset < totalSize) {
      if (channel.bufferedAmount > 1024 * 1024) {
        // Wait for buffer to drain
        await new Promise<void>((resolve) => {
          const onLow = () => {
            channel.removeEventListener('bufferedamountlow', onLow);
            resolve();
          };
          channel.addEventListener('bufferedamountlow', onLow);
        });
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      channel.send(buffer);

      offset += buffer.byteLength;

      if (onProgress) {
        onProgress({
          fileId,
          fileName: file.name,
          bytesTransferred: offset,
          totalBytes: totalSize,
          percentage: Math.min(100, Math.round((offset / totalSize) * 100)),
        });
      }
    }

    if (totalSize > 0 && onProgress) {
      onProgress({
        fileId,
        fileName: file.name,
        bytesTransferred: totalSize,
        totalBytes: totalSize,
        percentage: 100,
      });
    }

    // Send EOF marker
    channel.send(JSON.stringify({ type: 'eof', fileId }));
  }

  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
