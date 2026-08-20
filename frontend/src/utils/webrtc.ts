export const DEFAULT_STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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

  constructor(config?: RTCConfiguration) {
    if (typeof window !== 'undefined') {
      this.peerConnection = new RTCPeerConnection(config || DEFAULT_STUN_CONFIG);
      this.setupConnectionListeners();
    }
  }

  private setupConnectionListeners(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onStateChangeCb) {
        this.onStateChangeCb(this.peerConnection.connectionState);
      }
    };
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

  public createDataChannel(label = 'fileTransfer'): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('Peer Connection not available');
    }
    this.dataChannel = this.peerConnection.createDataChannel(label, {
      ordered: true,
    });
    this.dataChannel.binaryType = 'arraybuffer';
    return this.dataChannel;
  }

  public setDataChannel(dc: RTCDataChannel): void {
    this.dataChannel = dc;
    this.dataChannel.binaryType = 'arraybuffer';
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
