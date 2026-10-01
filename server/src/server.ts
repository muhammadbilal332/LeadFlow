import { createApp } from './app';
import { env } from './config/env';
import { isAiConfigured } from './services/aiService';
import { ensureDeveloperAccount } from './db/seedDeveloper';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`LeadFlow API listening on port ${env.PORT} (${env.NODE_ENV})`);
  console.log(`AI qualification: ${isAiConfigured() ? `enabled (${env.AI_PROVIDER})` : 'disabled (no provider configured)'}`);
});

ensureDeveloperAccount().catch((err) => {
  console.error('Failed to provision developer account:', err instanceof Error ? err.message : err);
});
