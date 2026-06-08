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

  describe('getOfferings parser parity (v0.5.22)', () => {
    // Customer audit on Interrupt (com.interrrupt.app, 2026-05-06)
    // recorded the actual /v1/sdk/offerings?user_id=... response shape.
    // This test locks the web parser's output so iOS Swift and
    // Android Kotlin parsers in the same release have a documented
    // contract to match. Customer's words: "A test fixture with a
    // single recorded API response that both web and iOS parsers
    // must produce identical structs from would catch this kind of
    // drift."
    const RECORDED_RESPONSE = {
      offerings: [
        {
          identifier: 'interrrupt_pro',
          packages: [
            {
              identifier: '$rc_monthly',
              product: {
                external_id: 'com.interrrupt.app.pro.monthly',
                display_name: 'Interrupt Pro Monthly',
                description: 'All packs and history.',
              },
              package_type: 'monthly',
              price: { formatted: '$9.99', amount_cents: 999, currency: 'USD' },
            },
            {
              identifier: '$rc_annual',
              product: {
                external_id: 'com.interrrupt.app.pro.annual',
                display_name: 'Interrupt Pro Annual',
              },
              package_type: 'annual',
              price: { formatted: '$79.99', amount_cents: 7999, currency: 'USD' },
            },
          ],
        },
      ],
    };

    it('maps packages[].product.external_id to product.identifier (not store_product_id)', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => RECORDED_RESPONSE,
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      const { offerings } = await sdk.getOfferings();

      expect(offerings).toHaveLength(1);
      expect(offerings[0].identifier).toBe('interrrupt_pro');
      expect(offerings[0].products).toHaveLength(2);

      const monthly = offerings[0].products[0];
      expect(monthly.identifier).toBe('com.interrrupt.app.pro.monthly');
      expect(monthly.title).toBe('Interrupt Pro Monthly');
      expect(monthly.priceString).toBe('$9.99');
      expect(monthly.priceAmountMicros).toBe(9_990_000); // 999 cents * 10000
      expect(monthly.currencyCode).toBe('USD');
      expect(monthly.productType).toBe('monthly');

      const annual = offerings[0].products[1];
      expect(annual.identifier).toBe('com.interrrupt.app.pro.annual');
      expect(annual.priceString).toBe('$79.99');

      vi.unstubAllGlobals();
    });

    it('falls back to pkg.identifier when product.external_id is missing', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          offerings: [
            {
              identifier: 'interrrupt_pro',
              packages: [
                {
                  identifier: '$rc_lifetime',
                  product: {}, // no external_id
                  package_type: 'lifetime',
                  price: { formatted: '$199.99', amount_cents: 19999, currency: 'USD' },
                },
              ],
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      const { offerings } = await sdk.getOfferings();
      expect(offerings[0].products[0].identifier).toBe('$rc_lifetime');

      vi.unstubAllGlobals();
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

    it('should PROPAGATE 401 errors instead of silently returning template:null (v0.5.19 fix)', async () => {
      // Customer dogfood test (Interrupt) caught: getPaywallTemplate
      // pre-v0.5.19 swallowed every error — including 401 from the
      // backend rejecting `pk_test_*` — and silently returned
      // `template: null`. Apps couldn't tell why the paywall never
      // rendered. After v0.5.19 the SDK propagates the real error so
      // callers can surface "auth failed" vs "no template configured".
      const { CapivvWeb } = await import('../web');
      const { CapivvApiError } = await import('../definitions');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"error":{"code":"unauthorized","message":"Authentication required"}}',
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });

      await expect(sdk.getPaywall({ identifier: 'pro' })).rejects.toThrow(CapivvApiError);
      await expect(sdk.getPaywall({ identifier: 'pro' })).rejects.toMatchObject({
        status: 401,
      });

      vi.unstubAllGlobals();
    });

    it('should propagate 5xx errors (server down should not look like template:null)', async () => {
      const { CapivvWeb } = await import('../web');
      const { CapivvApiError } = await import('../definitions');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });

      await expect(sdk.getPaywall({ identifier: 'pro' })).rejects.toBeInstanceOf(CapivvApiError);

      vi.unstubAllGlobals();
    });
  });

  describe('getPaywall ?user_id passthrough (v0.5.37 — issue #16)', () => {
    it('does NOT include user_id when not identified (backward compat)', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          template: { components: [] },
          version: '1',
          updated_at: '2026-06-03T00:00:00Z',
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.getPaywall({ identifier: 'pro' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://app.capivv.com/v1/paywalls/by-identifier/pro/template');

      vi.unstubAllGlobals();
    });

    it('appends ?user_id when identified, surfaces appliedVariants', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        // identify
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        // getPaywall
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            template: { components: [{ type: 'headline', props: { text: 'Variant A copy' } }] },
            version: '2',
            updated_at: '2026-06-03T00:00:00Z',
            applied_variants: [
              {
                experiment_id: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
                experiment_name: 'paywall-annual-vs-monthly-default-v1',
                variant_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                variant_name: 'annual_default',
                is_control: false,
              },
            ],
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'google-oauth2|123' });
      const result = await sdk.getPaywall({ identifier: 'pro' });

      const [url] = fetchMock.mock.calls[1];
      // ?user_id is URL-encoded (the | becomes %7C).
      expect(url).toBe(
        'https://app.capivv.com/v1/paywalls/by-identifier/pro/template?user_id=google-oauth2%7C123',
      );
      expect(result.appliedVariants).toEqual([
        {
          experimentId: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
          experimentName: 'paywall-annual-vs-monthly-default-v1',
          variantId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          variantName: 'annual_default',
          isControl: false,
        },
      ]);

      vi.unstubAllGlobals();
    });
  });

  describe('getVariantForExperiment (v0.5.35 — issue #14)', () => {
    it('hits the right route and unwraps snake_case → camelCase', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        // identify
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        // getVariantForExperiment
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
            variant_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            variant_name: 'annual_default',
            is_control: false,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'google-oauth2|123' });

      const result = await sdk.getVariantForExperiment({
        experimentId: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
      });

      const [variantUrl] = fetchMock.mock.calls[1];
      // userId must be URL-encoded because it contains '|'.
      expect(variantUrl).toBe(
        'https://app.capivv.com/v1/sdk/users/google-oauth2%7C123/experiments/b410469c-7df5-45ba-acdb-c8fa4183aa23/variant',
      );
      expect(result).toEqual({
        experimentId: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
        variantId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        variantName: 'annual_default',
        isControl: false,
        config: null,
      });

      vi.unstubAllGlobals();
    });

    it('returns variantId:null when experiment is not running (200, not 404)', async () => {
      // Server returns 200 with variant_id=null for draft/paused/completed
      // experiments so app code can distinguish "no arm yet" from
      // "experiment doesn't exist" (which is 404 → CapivvApiError).
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
            variant_id: null,
            variant_name: null,
            is_control: null,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getVariantForExperiment({
        experimentId: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
      });
      expect(result.variantId).toBeNull();
      expect(result.variantName).toBeNull();
      expect(result.isControl).toBeNull();

      vi.unstubAllGlobals();
    });

    it('exposes experimentAssignments[] from identify() / getUserInfo()', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          entitlements: [],
          experiment_assignments: [
            {
              experiment_id: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
              experiment_name: 'paywall-annual-vs-monthly-default-v1',
              variant_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
              variant_name: 'annual_default',
              is_control: false,
              assigned_at: '2026-06-03T09:22:00Z',
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      const userInfo = await sdk.identify({ userId: 'u1' });

      expect(userInfo.experimentAssignments).toEqual([
        {
          experimentId: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
          experimentName: 'paywall-annual-vs-monthly-default-v1',
          variantId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          variantName: 'annual_default',
          isControl: false,
          assignedAt: '2026-06-03T09:22:00Z',
          // v0.5.40 — config defaults to {} when server omits it (older deploys
          // or no custom config set on the variant).
          config: {},
        },
      ]);

      vi.unstubAllGlobals();
    });
  });

  describe('getAssignedProductForExperiment (v0.5.40 — issue #18 Primitive 1)', () => {
    it('returns variant.config.product_override.external_id when present', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'price-monthly-tier-test-v1',
            variant_id: 'tier-2',
            variant_name: 't2',
            is_control: false,
            // The pricing-A/B pattern from #18: variant config carries an
            // external_id pointing at a pre-created Apple SKU.
            config: {
              product_override: {
                external_id: 'com.interrrupt.app.pro.monthly.t2',
              },
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getAssignedProductForExperiment({
        experimentId: 'price-monthly-tier-test-v1',
        fallbackProductId: 'com.interrrupt.app.pro.monthly',
      });

      expect(result).toEqual({
        productId: 'com.interrrupt.app.pro.monthly.t2',
        source: 'variant_override',
        variantId: 'tier-2',
        variantName: 't2',
        isControl: false,
      });

      vi.unstubAllGlobals();
    });

    it('falls back to fallbackProductId when variant has no product_override', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'price-monthly-tier-test-v1',
            variant_id: 'control',
            variant_name: 'control',
            is_control: true,
            // Control arm — no override; app should charge the default product.
            config: {},
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getAssignedProductForExperiment({
        experimentId: 'price-monthly-tier-test-v1',
        fallbackProductId: 'com.interrrupt.app.pro.monthly',
      });

      expect(result.productId).toBe('com.interrrupt.app.pro.monthly');
      expect(result.source).toBe('fallback');
      expect(result.isControl).toBe(true);

      vi.unstubAllGlobals();
    });

    it('honors country_codes filter: applies override when caller country matches', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'pt-br-tier-test-v1',
            variant_id: 'lower-tier',
            variant_name: 'lower',
            is_control: false,
            config: {
              product_override: {
                external_id: 'com.test.pro.monthly.br_lower',
                country_codes: ['BR', 'pt'], // mixed case to exercise normalization
              },
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getAssignedProductForExperiment({
        experimentId: 'pt-br-tier-test-v1',
        fallbackProductId: 'com.test.pro.monthly',
        countryCode: 'br', // lowercase from caller
      });

      expect(result.productId).toBe('com.test.pro.monthly.br_lower');
      expect(result.source).toBe('variant_override');

      vi.unstubAllGlobals();
    });

    it('honors country_codes filter: falls back when caller country does not match', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'pt-br-tier-test-v1',
            variant_id: 'lower-tier',
            variant_name: 'lower',
            is_control: false,
            config: {
              product_override: {
                external_id: 'com.test.pro.monthly.br_lower',
                country_codes: ['BR'],
              },
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getAssignedProductForExperiment({
        experimentId: 'pt-br-tier-test-v1',
        fallbackProductId: 'com.test.pro.monthly',
        countryCode: 'US',
      });

      expect(result.productId).toBe('com.test.pro.monthly');
      expect(result.source).toBe('fallback');
      // Variant data is still surfaced so app can log "user was in lower-tier
      // arm but country didn't match, used fallback price."
      expect(result.variantName).toBe('lower');

      vi.unstubAllGlobals();
    });

    it('applies override unconditionally when country_codes is absent (v0.5.41 behavior preserved)', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'global-tier-test',
            variant_id: 'tier-2',
            variant_name: 't2',
            is_control: false,
            config: {
              product_override: {
                external_id: 'com.test.pro.monthly.t2',
                // no country_codes → applies everywhere
              },
            },
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getAssignedProductForExperiment({
        experimentId: 'global-tier-test',
        fallbackProductId: 'com.test.pro.monthly',
        countryCode: 'JP',
      });

      expect(result.productId).toBe('com.test.pro.monthly.t2');
      expect(result.source).toBe('variant_override');

      vi.unstubAllGlobals();
    });

    it('falls back when experiment is not running (variantId null)', async () => {
      const { CapivvWeb } = await import('../web');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entitlements: [], experiment_assignments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            experiment_id: 'price-monthly-tier-test-v1',
            variant_id: null,
            variant_name: null,
            is_control: null,
            config: null,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const sdk = new CapivvWeb();
      await sdk.configure({ apiKey: 'pk_test_abc' });
      await sdk.identify({ userId: 'u1' });

      const result = await sdk.getAssignedProductForExperiment({
        experimentId: 'price-monthly-tier-test-v1',
        fallbackProductId: 'com.interrrupt.app.pro.monthly',
      });

      expect(result.productId).toBe('com.interrrupt.app.pro.monthly');
      expect(result.source).toBe('fallback');
      expect(result.variantId).toBeNull();

      vi.unstubAllGlobals();
    });
  });
});
