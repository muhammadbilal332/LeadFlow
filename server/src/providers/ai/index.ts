import { env } from '../../config/env';
import { AIProvider } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';
import { OpenAIProvider } from './OpenAIProvider';

const mockProvider = new MockAIProvider();
const openAiProvider = new OpenAIProvider();

export function getOutreachAIProvider(): AIProvider {
  return env.OUTREACH_AI_PROVIDER === 'openai' ? openAiProvider : mockProvider;
}

export * from './AIProvider';
