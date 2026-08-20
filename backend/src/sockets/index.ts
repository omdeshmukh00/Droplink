import { Server as HttpServer } from 'http';
import { socketService } from '../services/socket.service';

export const initSockets = (httpServer: HttpServer) => {
  return socketService.init(httpServer);
};
