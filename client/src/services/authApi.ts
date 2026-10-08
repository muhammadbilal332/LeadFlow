import { apiRequest } from '../lib/api';
import { User, Business } from '../types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string; role: string; businessId: string };
  business?: { id: string; name: string };
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: input });
}

export function getMe(): Promise<{ user: User }> {
  return apiRequest('/auth/me');
}

export function getBusiness(): Promise<{ business: Business }> {
  return apiRequest('/business');
}
