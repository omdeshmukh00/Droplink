export interface CleanupStatsDto {
  startTime: string;
  endTime: string;
  executionTime: number; // In milliseconds
  deletedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface CleanupResponseDto {
  success: boolean;
  message: string;
  stats: CleanupStatsDto | null;
}
