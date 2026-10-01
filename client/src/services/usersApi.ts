import { apiRequest } from '../lib/api';
import { User, Business } from '../types';

export function listUsers(): Promise<{ users: User[] }> {
  return apiRequest('/users');
}

export function createUser(input: { name: string; email: string; password: string; role: 'owner' | 'sales' }): Promise<{ user: User }> {
  return apiRequest('/users', { method: 'POST', body: input });
}

export function updateUser(id: string, input: Partial<{ name: string; isActive: boolean }>): Promise<{ user: User }> {
  return apiRequest(`/users/${id}`, { method: 'PATCH', body: input });
}

export function updateBusiness(input: Partial<{ name: string; email: string; phone: string; industry: string }>): Promise<{ business: Business }> {
  return apiRequest('/business', { method: 'PATCH', body: input });
}
