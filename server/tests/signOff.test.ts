import { describe, it, expect } from 'vitest';
import { firstNameOf, withSenderFirstName } from '../src/services/outreach/signOff';

describe('sender first name in outgoing emails', () => {
  it('takes the first word of the approver name', () => {
    expect(firstNameOf('Sarah Bennett')).toBe('Sarah');
    expect(firstNameOf('  Alex  ')).toBe('Alex');
    expect(firstNameOf(null)).toBeNull();
  });

  it('puts the first name right before the company signature', () => {
    const body = 'Worth a call this week?\n\nNova Growth Agency\n\n—\nNot interested? Just reply "unsubscribe".';
    expect(withSenderFirstName(body, 'Alex', 'Nova Growth Agency')).toBe(
      'Worth a call this week?\n\nBest,\nAlex\nNova Growth Agency\n\n—\nNot interested? Just reply "unsubscribe".'
    );
  });

  it('falls back to the unsubscribe footer, then to the end of the body', () => {
    expect(withSenderFirstName('Hi there.\n\n—\nNot interested? Just reply "unsubscribe".', 'Alex', 'Acme')).toBe(
      'Hi there.\n\nBest,\nAlex\n\n—\nNot interested? Just reply "unsubscribe".'
    );
    expect(withSenderFirstName('Hi there.', 'Alex', 'Acme')).toBe('Hi there.\n\nBest,\nAlex');
  });

  it('does not add the name twice and leaves the body alone without a sender', () => {
    const signed = 'Hi.\n\nBest,\nAlex\nAcme';
    expect(withSenderFirstName(signed, 'Alex', 'Acme')).toBe(signed);
    expect(withSenderFirstName('Hi.', null, 'Acme')).toBe('Hi.');
  });
});
