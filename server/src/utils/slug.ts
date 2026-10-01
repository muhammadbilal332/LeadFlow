import { randomUUID } from 'crypto';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

export function uniqueSlug(base: string): string {
  const suffix = randomUUID().slice(0, 8);
  return `${slugify(base)}-${suffix}`;
}
