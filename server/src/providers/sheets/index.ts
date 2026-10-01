import { env } from '../../config/env';
import { SheetsProvider } from './SheetsProvider';
import { MockSheetsProvider } from './MockSheetsProvider';
import { GoogleSheetsProvider } from './GoogleSheetsProvider';

const mockProvider = new MockSheetsProvider();
const googleProvider = new GoogleSheetsProvider();

export function getSheetsProvider(): SheetsProvider {
  return env.SHEETS_PROVIDER === 'google' ? googleProvider : mockProvider;
}

export * from './SheetsProvider';
