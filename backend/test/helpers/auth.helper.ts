import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export interface AuthTokens {
  cookie: string;
  accessToken?: string;
}

export async function getAuthCookie(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const setCookieHeader = response.headers['set-cookie'];
  if (!setCookieHeader) {
    throw new Error(`No set-cookie header returned for ${email}`);
  }
  return Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
}

export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookie: string; body: any }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const setCookieHeader = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookieHeader)
    ? setCookieHeader[0]
    : setCookieHeader ?? '';

  return { cookie, body: response.body };
}
