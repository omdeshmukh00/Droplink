import axios from 'axios';
import { getApiUrl } from '../config/api';

export const DEFAULT_STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:stun.services.mozilla.com',
      ],
    },
  ],
};

let cachedIceConfig: RTCConfiguration | null = null;
let cachedTurnOnlyIceConfig: RTCConfiguration | null = null;

/**
 * Fetches WebRTC ICE/TURN configuration from backend server.
 * Supports turnOnly diagnostic mode to test TURN relay strictly.
 */
export async function fetchIceConfiguration(options?: { turnOnly?: boolean }): Promise<RTCConfiguration> {
  const isTurnOnly = Boolean(options?.turnOnly);
  if (isTurnOnly && cachedTurnOnlyIceConfig) {
    return cachedTurnOnlyIceConfig;
  }
  if (!isTurnOnly && cachedIceConfig) {
    return cachedIceConfig;
  }

  try {
    const apiUrl = getApiUrl();
    const url = `${apiUrl}/webrtc/config${isTurnOnly ? '?turnOnly=true' : ''}`;
    const response = await axios.get<{
      success: boolean;
      data?: { iceServers?: RTCIceServer[]; isTurnOnlyMode?: boolean };
    }>(url, { timeout: 4000 });

    if (response.data?.success && Array.isArray(response.data?.data?.iceServers)) {
      const config = { iceServers: response.data.data.iceServers };
      if (isTurnOnly) {
        cachedTurnOnlyIceConfig = config;
      } else {
        cachedIceConfig = config;
      }
      console.log(`[WEBRTC DEBUG] Successfully fetched ICE config (turnOnly=${isTurnOnly})`);
      return config;
    }
  } catch (err) {
    console.warn('[WEBRTC DEBUG] Failed to fetch server ICE config, falling back to DEFAULT_STUN_CONFIG:', err);
  }

  return DEFAULT_STUN_CONFIG;
}

export const CHUNK_SIZE = 16384; // 16KB per chunk for optimal cross-browser SCTP throughput
export const BLOCK_SIZE = 1024 * 1024; // 1MB block size for in-memory slicing

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
}

export function formatETA(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface WebRTCTransferProgress {
  fileId: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  speedFormatted: string;
  etaSeconds: number;
  etaFormatted: string;
  bytesFormatted: string;
}

export type WebRTCConnectionStateCallback = (state: RTCPeerConnectionState, readyStateLabel?: string) => void;

export interface CandidatePairDetails {
  localCandidateType: string;
  localProtocol: string;
  localIp?: string;
  remoteCandidateType: string;
  remoteProtocol: string;
  remoteIp?: string;
  isRelay: boolean;
  transportType: string; // 'P2P (Host/STUN)' | 'TURN Relay'
}

export class WebRTCPeerManager {
  private id: string;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onStateChangeCb: WebRTCConnectionStateCallback | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private selectedCandidatePair: CandidatePairDetails | null = null;

  constructor(config?: RTCConfiguration, managerId?: string) {
    this.id = managerId || `peer_${Math.random().toString(36).substring(2, 8)}`;
    if (typeof window !== 'undefined') {
      console.log(`[WEBRTC DEBUG] [${this.id}] createPeerConnection`);
      this.peerConnection = new RTCPeerConnection(config || DEFAULT_STUN_CONFIG);
      this.setupConnectionListeners();
    }
  }

  public static async create(options?: { config?: RTCConfiguration; managerId?: string; turnOnly?: boolean }): Promise<WebRTCPeerManager> {
    const iceConfig = options?.config || (await fetchIceConfiguration({ turnOnly: options?.turnOnly }));
    return new WebRTCPeerManager(iceConfig, options?.managerId);
  }

  public getId(): string {
    return this.id;
  }

  private setupConnectionListeners(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        console.log(`[WEBRTC DEBUG] [${this.id}] connectionState -> ${state}`);
        if (state === 'connected') {
          console.log(`[WEBRTC DEBUG] [${this.id}] RTC CONNECTION CONNECTED`);
          this.logSelectedCandidatePair();
        } else if (state === 'failed') {
          console.warn(`[WEBRTC DEBUG] [${this.id}] ICE FAILED`);
        }
        if (this.onStateChangeCb) {
          this.onStateChangeCb(state);
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        const iceState = this.peerConnection.iceConnectionState;
        console.log(`[WEBRTC DEBUG] [${this.id}] iceConnectionState -> ${iceState}`);
        if (iceState === 'connected' || iceState === 'completed') {
          this.logSelectedCandidatePair();
        } else if (iceState === 'failed') {
          console.error(`[WEBRTC DEBUG] [${this.id}] ICE FAILED (iceConnectionState)`);
        }
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WEBRTC DEBUG] [${this.id}] iceGatheringState -> ${this.peerConnection.iceGatheringState}`);
      }
    };

    this.peerConnection.onsignalingstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WEBRTC DEBUG] [${this.id}] signalingState -> ${this.peerConnection.signalingState}`);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type || 'unknown';
        const protocol = event.candidate.protocol || 'unknown';
        const address = event.candidate.address || event.candidate.candidate.split(' ')[4] || 'obscured/mDNS';
        console.log(`[WEBRTC DEBUG] [${this.id}] Local candidate gathered: type=${type}, protocol=${protocol}, address=${address}`);
      } else {
        console.log(`[WEBRTC DEBUG] [${this.id}] Local candidate gathering complete (null candidate).`);
      }
    };
  }

  public async logSelectedCandidatePair(): Promise<CandidatePairDetails | null> {
    if (!this.peerConnection) return null;
    try {
      const stats = await this.peerConnection.getStats();
      let activePair: CandidatePairDetails | null = null;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          const localCand = stats.get(report.localCandidateId);
          const remoteCand = stats.get(report.remoteCandidateId);

          const localType = localCand?.candidateType || 'unknown';
          const remoteType = remoteCand?.candidateType || 'unknown';
          const isRelay = localType === 'relay' || remoteType === 'relay';

          activePair = {
            localCandidateType: localType,
            localProtocol: localCand?.protocol || 'unknown',
            localIp: localCand?.ip || localCand?.address,
            remoteCandidateType: remoteType,
            remoteProtocol: remoteCand?.protocol || 'unknown',
            remoteIp: remoteCand?.ip || remoteCand?.address,
            isRelay,
            transportType: isRelay ? 'TURN Relay' : `Direct P2P (${localType.toUpperCase()}/${remoteType.toUpperCase()})`,
          };

          this.selectedCandidatePair = activePair;

          console.log(
            `[WEBRTC DEBUG] [${this.id}] Selected Candidate Pair: ${activePair.transportType} | Local: ${localType} (${activePair.localIp || 'hidden'}) <-> Remote: ${remoteType} (${activePair.remoteIp || 'hidden'})`
          );
        }
      });

      return activePair;
    } catch (err) {
      console.warn(`[WEBRTC DEBUG] [${this.id}] Error retrieving stats for candidate pair:`, err);
      return null;
    }
  }

  public getSelectedCandidatePairDetails(): CandidatePairDetails | null {
    return this.selectedCandidatePair;
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

  public async createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('RTCPeerConnection is not initialized');
    console.log(`[WEBRTC DEBUG] [${this.id}] createOffer`);
    const offer = await this.peerConnection.createOffer(options);
    console.log(`[WEBRTC DEBUG] [${this.id}] setLocalDescription (type: ${offer.type})`);
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('RTCPeerConnection is not initialized');
    console.log(`[WEBRTC DEBUG] [${this.id}] createAnswer`);
    const answer = await this.peerConnection.createAnswer(options);
    console.log(`[WEBRTC DEBUG] [${this.id}] setLocalDescription (type: ${answer.type})`);
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('RTCPeerConnection is not initialized');
    if (desc.type === 'answer') {
      console.log(`[WEBRTC DEBUG] [${this.id}] receivedAnswer`);
    }
    console.log(`[WEBRTC DEBUG] [${this.id}] setRemoteDescription (type: ${desc.type})`);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    await this.processBufferedIceCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        const candObj = typeof candidate === 'string' ? null : candidate;
        const candStr = candObj?.candidate || '';
        const match = candStr.match(/typ\s+(\w+)/);
        const candType = match ? match[1] : 'unknown';
        console.log(`[WEBRTC DEBUG] [${this.id}] addIceCandidate: addedImmediately type=${candType}`);
      } catch (err) {
        console.warn(`[WEBRTC DEBUG] [${this.id}] Failed to add ICE candidate:`, err);
      }
    } else {
      const isDuplicate = this.iceCandidateQueue.some(
        (c) =>
          c.candidate === candidate.candidate &&
          c.sdpMid === candidate.sdpMid &&
          c.sdpMLineIndex === candidate.sdpMLineIndex
      );
      if (!isDuplicate) {
        console.log(`[WEBRTC DEBUG] [${this.id}] addIceCandidate: queued (remoteDescription not set yet)`);
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
        console.log(`[WEBRTC DEBUG] [${this.id}] Successfully processed queued remote ICE candidate`);
      } catch (err) {
        console.warn(`[WEBRTC DEBUG] [${this.id}] Failed to add queued ICE candidate:`, err);
      }
    }
  }

  public createDataChannel(label = 'fileTransfer'): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('Peer Connection not available');
    }
    console.log(`[WEBRTC DEBUG] [${this.id}] createDataChannel (label: ${label})`);
    this.dataChannel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });
    this.dataChannel.binaryType = 'arraybuffer';
    this.attachDataChannelListeners(this.dataChannel);
    return this.dataChannel;
  }

  public setDataChannel(dc: RTCDataChannel): void {
    console.log(`[WEBRTC DEBUG] [${this.id}] setDataChannel (label: ${dc.label}, readyState: ${dc.readyState})`);
    this.dataChannel = dc;
    this.dataChannel.binaryType = 'arraybuffer';
    this.attachDataChannelListeners(this.dataChannel);
  }

  private attachDataChannelListeners(dc: RTCDataChannel): void {
    dc.addEventListener('open', () => {
      console.log(`[WEBRTC DEBUG] [${this.id}] DATA CHANNEL OPEN (label: ${dc.label})`);
      console.log(`[WEBRTC DEBUG] [${this.id}] dataChannel.readyState -> ${dc.readyState}`);
    });
    dc.addEventListener('close', () => {
      console.log(`[WEBRTC DEBUG] [${this.id}] DATA CHANNEL CLOSED (label: ${dc.label})`);
      console.log(`[WEBRTC DEBUG] [${this.id}] dataChannel.readyState -> ${dc.readyState}`);
    });
    dc.addEventListener('error', (err) => {
      console.warn(`[WEBRTC DEBUG] [${this.id}] dataChannel error (label: ${dc.label}):`, err);
    });
  }

  public getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  public isDataChannelOpen(): boolean {
    return Boolean(this.dataChannel && this.dataChannel.readyState === 'open');
  }

  /**
   * Sends a File over DataChannel using high-throughput memory-buffered streaming.
   * - Block-reads 1MB slices from File to minimize async disk I/O.
   * - Transmits in 32KB chunks via DataChannel.
   * - Backpressure low threshold set to 256KB (high watermark 1.5MB) to keep SCTP pipe filled.
   * - Throttles UI progress updates to 100ms intervals to eliminate main thread lag.
   */
  public async sendFile(
    file: File,
    fileId: string,
    onProgress?: (progress: WebRTCTransferProgress) => void,
    extraMetadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error(`DataChannel is not open (readyState: ${this.dataChannel?.readyState || 'none'})`);
    }

    console.log(`[WEBRTC DEBUG] [${this.id}] transfer started (fileId: ${fileId}, size: ${file.size} bytes)`);

    const channel = this.dataChannel;
    // Set low threshold to 256KB so SCTP buffer stays continuously fed
    channel.bufferedAmountLowThreshold = 256 * 1024;

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

    const startTime = Date.now();
    let offset = 0;
    const totalSize = file.size;
    let lastProgressTime = 0;

    const buildProgressPayload = (bytes: number): WebRTCTransferProgress => {
      const now = Date.now();
      const elapsedSec = (now - startTime) / 1000;
      const speedBytesPerSec = elapsedSec > 0 ? Math.round(bytes / elapsedSec) : 0;
      const remainingBytes = Math.max(0, totalSize - bytes);
      const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

      return {
        fileId,
        fileName: file.name,
        bytesTransferred: bytes,
        totalBytes: totalSize,
        percentage: totalSize === 0 ? 100 : Math.min(100, Math.round((bytes / totalSize) * 100)),
        speedBytesPerSec,
        speedFormatted: formatSpeed(speedBytesPerSec),
        etaSeconds,
        etaFormatted: formatETA(etaSeconds),
        bytesFormatted: `${formatBytes(bytes)} / ${formatBytes(totalSize)}`,
      };
    };

    if (totalSize === 0 && onProgress) {
      onProgress(buildProgressPayload(0));
    }

    while (offset < totalSize) {
      // Read up to 1MB into memory to avoid repeated async disk reads per 32KB chunk
      const blockLength = Math.min(BLOCK_SIZE, totalSize - offset);
      const blockSlice = file.slice(offset, offset + blockLength);
      const blockBuffer = await blockSlice.arrayBuffer();

      let blockOffset = 0;
      while (blockOffset < blockBuffer.byteLength) {
        if (channel.bufferedAmount > 1536 * 1024) {
          // Wait for buffer to drain to 256KB threshold
          await new Promise<void>((resolve) => {
            const onLow = () => {
              channel.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            channel.addEventListener('bufferedamountlow', onLow);
          });
        }

        const chunkLength = Math.min(CHUNK_SIZE, blockBuffer.byteLength - blockOffset);
        const chunk = blockBuffer.slice(blockOffset, blockOffset + chunkLength);
        channel.send(chunk);

        blockOffset += chunkLength;
        offset += chunkLength;

        // Throttle progress updates to at most once per 100ms
        const now = Date.now();
        if (onProgress && (now - lastProgressTime > 100 || offset >= totalSize)) {
          lastProgressTime = now;
          onProgress(buildProgressPayload(offset));
        }
      }
    }

    if (totalSize > 0 && onProgress) {
      onProgress(buildProgressPayload(totalSize));
    }

    // Send EOF marker
    channel.send(JSON.stringify({ type: 'eof', fileId }));
    console.log(`[WEBRTC DEBUG] [${this.id}] transfer completed (fileId: ${fileId})`);
  }

  public close(): void {
    console.log(`[WEBRTC DEBUG] [${this.id}] peer connection closed`);
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

