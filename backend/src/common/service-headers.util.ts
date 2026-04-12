import { randomUUID } from 'crypto';

export interface ValidatedServiceUser {
  id: string;
  email: string;
  role: string;
  district?: string | null;
}

export function buildServiceHeaders(
  user?: ValidatedServiceUser,
): Record<string, string> {
  const headers: Record<string, string> = {
    'x-request-id': randomUUID(),
    'content-type': 'application/json',
  };

  if (user) {
    headers['x-user-id'] = user.id;
    headers['x-user-role'] = user.role;
    headers['x-user-district'] = user.district ?? '';
  }

  return headers;
}
