process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-please-ignore-1234567890';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/leadflow_test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.PORT = '4000';
process.env.AI_PROVIDER = 'none';
process.env.PUBLIC_APP_URL = 'http://localhost:5173';
process.env.META_APP_ID = 'test-meta-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.META_VERIFY_TOKEN = 'test-verify-token';
process.env.WEBHOOK_ENCRYPTION_KEY = 'test-webhook-encryption-key-1234567890';

// Outreach providers must always run in mock mode during tests, regardless
// of whatever real provider/keys the developer's own .env configures for
// local manual testing (e.g. a real Resend/Google API key) — tests must
// stay deterministic, free, and offline. dotenv (loaded later by env.ts)
// never overwrites a variable that's already set, so pinning these here is
// what keeps real credentials from ever leaking into the test run.
process.env.EMAIL_PROVIDER = 'mock';
process.env.OUTREACH_AI_PROVIDER = 'mock';
process.env.SHEETS_PROVIDER = 'mock';
process.env.INBOUND_PROVIDER = 'mock';
process.env.RESEND_API_KEY = '';
process.env.RESEND_WEBHOOK_SECRET = '';
process.env.GOOGLE_API_KEY = '';
