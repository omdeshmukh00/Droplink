export function getDefaultDeviceName(): string {
  if (typeof window === 'undefined') return 'Browser User';

  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'Device';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // UTC offset calculation
  const offsetMinutes = -new Date().getTimezoneOffset();
  const offsetHours = offsetMinutes / 60;
  const sign = offsetHours >= 0 ? '+' : '';
  const formattedUtc = `UTC${sign}${offsetHours}`;

  return `${browser} on ${os} (${formattedUtc})`;
}
