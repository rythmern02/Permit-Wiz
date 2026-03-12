import { describe, it, expect } from 'vitest';
import { buildDomain, PERMIT_TYPES } from '../lib/eip712';

describe('EIP-712 Domain Logic', () => {
  it('correctly builds a domain object', () => {
    const domain = buildDomain('TestToken', '1', 30, '0x1234567890123456789012345678901234567890');
    
    expect(domain.name).toBe('TestToken');
    expect(domain.version).toBe('1');
    expect(domain.chainId).toBe(30);
    expect(domain.verifyingContract).toBe('0x1234567890123456789012345678901234567890');
  });

  it('correctly maps PERMIT_TYPES', () => {
    expect(PERMIT_TYPES.Permit).toBeDefined();
    expect(PERMIT_TYPES.Permit.length).toBe(5);
    expect(PERMIT_TYPES.Permit[0].name).toBe('owner');
  });
});
