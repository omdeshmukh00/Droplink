import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from '@/config/api';

class SocketClient {
  private static instance: SocketClient;
  private socket: Socket | null = null;

  private constructor() {}

  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  public getSocket(): Socket {
    if (!this.socket) {
      const backendUrl = getBackendUrl();
      this.socket = io(`${backendUrl}/socket`, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
    }
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = SocketClient.getInstance();
