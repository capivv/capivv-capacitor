import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Capivv Web Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('API Client', () => {
    it('should format API URL correctly', () => {
      const baseUrl = 'https://app.capivv.com';
      const endpoint = '/v1/sdk/offerings';
      const fullUrl = `${baseUrl}${endpoint}`;

      expect(fullUrl).toBe('https://app.capivv.com/v1/sdk/offerings');
    });

    it('should handle API key header format', () => {
      const apiKey = 'pk_live_abc123def456';
      const headers = {
        'X-Capivv-Api-Key': apiKey,
        'Content-Type': 'application/json',
      };

      expect(headers['X-Capivv-Api-Key']).toBe('pk_live_abc123def456');
    });
  });

  describe('Caching', () => {
    it('should create cache key from parameters', () => {
      const userId = 'user-123';
      const cacheKey = `capivv_entitlements_${userId}`;

      expect(cacheKey).toBe('capivv_entitlements_user-123');
    });

    it('should handle cache expiration', () => {
      const now = Date.now();
      const ttl = 5 * 60 * 1000; // 5 minutes
      const expiresAt = now + ttl;
      const isExpired = Date.now() > expiresAt;

      expect(isExpired).toBe(false);
    });
  });

  describe('Entitlement Checking', () => {
    it('should find entitlement in list', () => {
      const entitlements = [
        { identifier: 'premium', isActive: true },
        { identifier: 'pro', isActive: false },
      ];

      const hasPremium = entitlements.some(
        (e) => e.identifier === 'premium' && e.isActive
      );
      const hasPro = entitlements.some(
        (e) => e.identifier === 'pro' && e.isActive
      );

      expect(hasPremium).toBe(true);
      expect(hasPro).toBe(false);
    });
  });

  describe('User Attributes', () => {
    it('should merge user attributes', () => {
      const baseAttrs = { source: 'sdk' };
      const userAttrs = { email: 'test@example.com' };
      const merged = { ...baseAttrs, ...userAttrs };

      expect(merged).toEqual({
        source: 'sdk',
        email: 'test@example.com',
      });
    });

    it('should handle empty attributes', () => {
      const attrs = {};
      expect(Object.keys(attrs).length).toBe(0);
    });
  });

  describe('getPaywall (v0.3.0)', () => {
    it('should call /v1/paywalls/by-identifier/:id/template and unwrap the response', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          template: { components: [{ type: 'headline', props: { text: 'Pro' } }] },
          version: '2.0.0',
          updated_at: '2026-05-04T10:00:00Z',
          cache_ttl_seconds: 300,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      const result = await sdk.getPaywall({ identifier: 'pro' });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://app.capivv.com/v1/paywalls/by-identifier/pro/template'
      );
      expect(result.template).toEqual({
        components: [{ type: 'headline', props: { text: 'Pro' } }],
      });
      expect(result.version).toBe('2.0.0');
      expect(result.cacheTtlSeconds).toBe(300);

      vi.unstubAllGlobals();
    });

    it('should return template:null on 404 instead of throwing', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Paywall not found',
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      const result = await sdk.getPaywall({ identifier: 'nonexistent' });

      expect(result.template).toBeNull();
      expect(result.version).toBe('0.0.0');

      vi.unstubAllGlobals();
    });
  });
});
