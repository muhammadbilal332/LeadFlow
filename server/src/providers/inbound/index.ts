import { env } from '../../config/env';
import { InboundProvider } from './InboundProvider';
import { MockInboundProvider } from './MockInboundProvider';
import { ResendInboundProvider } from './ResendInboundProvider';

const mockProvider = new MockInboundProvider();
const resendProvider = new ResendInboundProvider();

export function getInboundProvider(): InboundProvider {
  return env.INBOUND_PROVIDER === 'resend' ? resendProvider : mockProvider;
}

export function getMockInboundProvider(): MockInboundProvider {
  return mockProvider;
}

export * from './InboundProvider';
