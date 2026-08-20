export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, any>;
  };
  meta?: Record<string, any>;
}

export interface HealthCheckResponse {
  status: string;
  uptime?: number;
  timestamp?: string;
  database?: string;
}
