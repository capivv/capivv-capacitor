import { WebPlugin } from '@capacitor/core';

import type {
  CapivvPlugin,
  CapivvConfig,
  UserAttributes,
  UserInfo,
  Offering,
  Product,
  ProductType,
  PurchaseResult,
  Entitlement,
  EntitlementCheckResult,
  PaywallResult,
  VariantAssignment,
  ExperimentAssignment,
  AssignedProduct,
  PromotionalOfferPayload,
} from './definitions';
import { CapivvApiError } from './definitions';
import { PurchaseState } from './definitions';
import type { TemplateDefinition, TemplateLoadResult } from './templates/types';

/**
 * Web implementation of the Capivv plugin.
 * Uses the Capivv REST API for entitlements, offerings, and user management.
 * Purchases on web use Stripe Checkout via the Capivv API.
 * Native purchases use StoreKit 2 (iOS) and Google Play Billing (Android).
 */
export class CapivvWeb extends WebPlugin implements CapivvPlugin {
  private capivvConfig: CapivvConfig | null = null;
  private userId: string | null = null;
  private apiUrl: string = 'https://app.capivv.com';

  async configure(config: CapivvConfig): Promise<void> {
    this.capivvConfig = config;
    if (config.apiUrl) {
      this.apiUrl = config.apiUrl;
    }
    if (config.debug) {
      console.log('[Capivv] Configured with API URL:', this.apiUrl);
    }
  }

  async identify(options: {
    userId: string;
    attributes?: UserAttributes;
    preExperimentCovariates?: Record<string, number>;
  }): Promise<UserInfo> {
    this.ensureConfigured();
    this.userId = options.userId;

    const response = await this.apiRequest('POST', `/v1/sdk/users`, {
      external_id: options.userId,
      attributes: options.attributes,
      // v0.5.51 — CUPED ingest. Backend UPSERTs by (user, covariate_name).
      pre_experiment_covariates: options.preExperimentCovariates,
    });

    const data = response as any;
    // v0.5.63 — issue #31. The server mints a per-user device-bound
    // deletion token on the FIRST identify (absent thereafter). Persist
    // it locally so deleteCurrentUser() can present it later. Kept
    // SDK-internal — the app never handles the token.
    if (typeof data.deletion_token === 'string' && data.deletion_token) {
      this.storeDeletionToken(data.deletion_token);
    }
    return {
      userId: options.userId,
      entitlements: data.entitlements || [],
      originalPurchaseDate: data.original_purchase_date,
      latestPurchaseDate: data.latest_purchase_date,
      // v0.5.35 — issue #14. Server may omit the field for older deploys
      // — treat absent as empty rather than undefined leaking through.
      experimentAssignments: mapExperimentAssignments(data.experiment_assignments),
    };
  }

  async logout(): Promise<void> {
    this.userId = null;
  }

  /**
   * v0.5.63 — issue #31 / RFC #30. Erase the current user's Capivv data,
   * authorized by the device-bound deletion token minted on identify
   * (not the publishable key). See CapivvPlugin.deleteCurrentUser docs.
   */
  async deleteCurrentUser(options?: { hardDelete?: boolean }): Promise<{ status: string }> {
    this.ensureConfigured();
    const token = this.readDeletionToken();
    if (!token) {
      throw new Error(
        'Capivv.deleteCurrentUser: no deletion token available. It is minted on the first ' +
          'identify() — call identify() to obtain one, or perform deletion server-side with a ' +
          'secret (sk_) key. (Users created before deletion support, or after local storage was ' +
          'cleared, will not have a token until the next identify().)',
      );
    }
    const response = await this.apiRequest('POST', '/v1/sdk/users/delete-current', {
      deletion_token: token,
      hard_delete: options?.hardDelete ?? false,
    });
    // Erased — clear local identity + the now-consumed token.
    this.clearDeletionToken();
    this.userId = null;
    return { status: (response as { status?: string }).status ?? 'anonymized' };
  }

  // v0.5.63 — issue #31. Deletion-token persistence. localStorage is the
  // web equivalent of the native secure store; guarded so the SDK still
  // works in non-browser contexts (SSR/tests) where it's undefined.
  private readonly deletionTokenKey = 'capivv_deletion_token';
  private storeDeletionToken(token: string): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(this.deletionTokenKey, token);
    } catch {
      /* storage unavailable — deleteCurrentUser will surface a clear error */
    }
  }
  private readDeletionToken(): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(this.deletionTokenKey) : null;
    } catch {
      return null;
    }
  }
  private clearDeletionToken(): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(this.deletionTokenKey);
    } catch {
      /* ignore */
    }
  }

  async getUserInfo(): Promise<UserInfo> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/sdk/users/${this.userId}/entitlements`);

    const data = response as any;
    return {
      userId: this.userId!,
      entitlements: data.entitlements || [],
      // v0.5.35 — issue #14. Same backend bundles assignments under
      // `experiment_assignments`; mapper handles snake_case → camel.
      experimentAssignments: mapExperimentAssignments(data.experiment_assignments),
    };
  }

  /**
   * v0.5.35 — per-experiment variant lookup. Issue #14. See definitions.ts
   * for full doc — server route is
   * `GET /v1/sdk/users/:user_id/experiments/:experiment_id/variant`.
   */
  async getVariantForExperiment(options: { experimentId: string }): Promise<VariantAssignment> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest(
      'GET',
      `/v1/sdk/users/${encodeURIComponent(this.userId!)}/experiments/${encodeURIComponent(
        options.experimentId,
      )}/variant`,
    );

    const data = response as any;
    return {
      experimentId: data.experiment_id,
      variantId: data.variant_id ?? null,
      variantName: data.variant_name ?? null,
      isControl: data.is_control ?? null,
      // v0.5.40 — issue #18 Primitive 1. Server returns the object as-is.
      config: (data.config as Record<string, unknown> | null | undefined) ?? null,
    };
  }

  /**
   * v0.5.44 — issue #18 Primitive 3. See definitions.ts for full doc.
   */
  async getPromotionalOfferForExperiment(options: {
    experimentId: string;
    productIdentifier?: string;
  }): Promise<PromotionalOfferPayload> {
    this.ensureConfigured();
    this.ensureIdentified();

    const params = options.productIdentifier
      ? `?product_identifier=${encodeURIComponent(options.productIdentifier)}`
      : '';
    const response = await this.apiRequest(
      'GET',
      `/v1/sdk/users/${encodeURIComponent(this.userId!)}/experiments/${encodeURIComponent(
        options.experimentId,
      )}/promotional-offer${params}`,
    );

    const data = response as Record<string, unknown>;
    return {
      keyIdentifier: data.key_identifier as string,
      nonce: data.nonce as string,
      timestampMs: data.timestamp_ms as string,
      signatureBase64: data.signature_base64 as string,
    };
  }

  /**
   * v0.5.40 — issue #18 Primitive 1. See definitions.ts for full doc.
   * Wraps getVariantForExperiment and resolves to the right product id.
   */
  async getAssignedProductForExperiment(options: {
    experimentId: string;
    fallbackProductId: string;
    countryCode?: string;
  }): Promise<AssignedProduct> {
    const va = await this.getVariantForExperiment({ experimentId: options.experimentId });
    // The override convention: variant.config.product_override.external_id
    // is the SKU the app should pass to Capivv.purchase. If absent (control
    // arm, no override, or no running experiment), use the fallback.
    const override = va.config?.product_override as
      | { external_id?: string; product_id?: string; country_codes?: unknown }
      | undefined;
    // v0.5.42 — issue #18 Primitive 2. If the override specifies
    // country_codes, only apply when the caller's countryCode matches
    // one of them. countryCode unset → ignore the filter (preserves
    // v0.5.41 behavior). country_codes unset → override applies
    // unconditionally (also v0.5.41 behavior). Case-insensitive match
    // because Apple gives ISO 3166-1 alpha-2 uppercase, but operators
    // may type either case in the config.
    const countryFilter = Array.isArray(override?.country_codes)
      ? (override?.country_codes as unknown[])
          .filter((c): c is string => typeof c === 'string')
          .map((c) => c.toUpperCase())
      : null;
    const countryMatches =
      countryFilter === null ||
      countryFilter.length === 0 ||
      (typeof options.countryCode === 'string' &&
        countryFilter.includes(options.countryCode.toUpperCase()));
    const overrideId =
      countryMatches &&
      typeof override?.external_id === 'string' &&
      override.external_id.length > 0
        ? override.external_id
        : null;
    return {
      productId: overrideId ?? options.fallbackProductId,
      source: overrideId ? 'variant_override' : 'fallback',
      variantId: va.variantId,
      variantName: va.variantName,
      isControl: va.isControl,
    };
  }

  async isBillingSupported(): Promise<{ isSupported: boolean }> {
    // Web purchases are supported via Stripe Checkout (requires Stripe integration
    // configured in the Capivv dashboard).
    return { isSupported: true };
  }

  async getOfferings(): Promise<{ offerings: Offering[] }> {
    this.ensureConfigured();

    const params = this.userId ? `?user_id=${encodeURIComponent(this.userId)}` : '';
    const response = await this.apiRequest('GET', `/v1/sdk/offerings${params}`);

    const data = response as any;
    return {
      offerings: (data.offerings || []).map(this.mapOffering),
    };
  }

  async getProduct(options: {
    productIdentifier: string;
    productType?: ProductType;
  }): Promise<{ product: Product }> {
    this.ensureConfigured();

    const offerings = await this.getOfferings();
    for (const offering of offerings.offerings) {
      const product = offering.products.find((p) => p.identifier === options.productIdentifier);
      if (product) {
        return { product };
      }
    }

    throw new Error(`Product not found: ${options.productIdentifier}`);
  }

  async getProducts(options: {
    productIdentifiers: string[];
    productType?: ProductType;
  }): Promise<{ products: Product[] }> {
    this.ensureConfigured();

    const offerings = await this.getOfferings();
    const products: Product[] = [];

    for (const offering of offerings.offerings) {
      for (const product of offering.products) {
        if (options.productIdentifiers.includes(product.identifier)) {
          products.push(product);
        }
      }
    }

    return { products };
  }

  async purchase(options: {
    productIdentifier: string;
    productType?: ProductType;
    planIdentifier?: string;
    quantity?: number;
  }): Promise<PurchaseResult> {
    this.ensureConfigured();
    this.ensureIdentified();

    // Web purchases go through Stripe Checkout via the Capivv API.
    // 1. Create a Stripe Checkout Session on the backend
    // 2. Redirect the user to Stripe's hosted checkout page
    // 3. After payment, user is redirected back to success_url with session_id
    // 4. Call verifyStripeSession() on the success page to finalize

    const successUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/purchase/success`
      : 'https://localhost/purchase/success';
    const cancelUrl = typeof window !== 'undefined'
      ? window.location.href
      : 'https://localhost/purchase/cancel';

    try {
      const response = await this.apiRequest('POST', '/v1/sdk/stripe/checkout-session', {
        userId: this.userId,
        productId: options.productIdentifier,
        successUrl,
        cancelUrl,
      });

      const data = response as { sessionId: string; url: string };

      // Redirect to Stripe Checkout
      if (typeof window !== 'undefined' && data.url) {
        window.location.href = data.url;
      }

      // This return won't be reached due to redirect, but satisfies the type
      return {
        success: true,
        transaction: {
          transactionId: data.sessionId,
          productIdentifier: options.productIdentifier,
          purchaseDate: new Date().toISOString(),
          state: PurchaseState.PURCHASED,
          isAcknowledged: false,
        },
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Purchase failed';
      this.notifyListeners('purchaseFailed', {
        productIdentifier: options.productIdentifier,
        error: errorMsg,
      });
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Verify a Stripe Checkout session after redirect.
   * Call this on your success page with the session_id from the URL query params.
   */
  async verifyStripeSession(sessionId: string): Promise<PurchaseResult> {
    this.ensureConfigured();

    try {
      const response = await this.apiRequest('POST', '/v1/sdk/stripe/verify-session', {
        sessionId,
      });

      const data = response as { success: boolean; entitlements: Entitlement[]; error?: string };

      if (data.success) {
        this.notifyListeners('purchaseCompleted', {
          transaction: {
            transactionId: sessionId,
            productIdentifier: 'stripe_checkout',
            purchaseDate: new Date().toISOString(),
            state: PurchaseState.PURCHASED,
            isAcknowledged: true,
          },
        });
        this.notifyListeners('entitlementsUpdated', {
          entitlements: data.entitlements,
        });
      }

      return {
        success: data.success,
        error: data.error,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Verification failed',
      };
    }
  }

  async restorePurchases(): Promise<{ entitlements: Entitlement[] }> {
    this.ensureConfigured();
    this.ensureIdentified();

    // Web doesn't have local purchases to restore
    // Just fetch current entitlements from server
    const response = await this.apiRequest('GET', `/v1/sdk/users/${this.userId}/entitlements`);

    const restoreData = response as any;
    return {
      entitlements: restoreData.entitlements || [],
    };
  }

  async checkEntitlement(options: {
    entitlementIdentifier: string;
  }): Promise<EntitlementCheckResult> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/sdk/users/${this.userId}/entitlements`);
    const checkData = response as any;
    const entitlements: Entitlement[] = checkData.entitlements || [];

    const entitlement = entitlements.find((e) => e.identifier === options.entitlementIdentifier);

    return {
      hasAccess: entitlement?.isActive ?? false,
      entitlement,
    };
  }

  async getEntitlements(): Promise<{ entitlements: Entitlement[] }> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/sdk/users/${this.userId}/entitlements`);
    const entData = response as any;
    return {
      entitlements: entData.entitlements || [],
    };
  }

  async syncPurchases(): Promise<{ entitlements: Entitlement[] }> {
    // Web doesn't have local purchases to sync
    return this.getEntitlements();
  }

  async manageSubscriptions(): Promise<void> {
    this.ensureConfigured();
    this.ensureIdentified();

    // On web, open Stripe's Customer Portal where users can manage their
    // subscriptions, update payment methods, and cancel.
    try {
      const returnUrl = typeof window !== 'undefined'
        ? window.location.href
        : 'https://localhost';

      const response = await this.apiRequest('POST', '/v1/sdk/stripe/customer-portal', {
        userId: this.userId,
        returnUrl,
      });

      const data = response as { url: string };

      if (typeof window !== 'undefined' && data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      // If Stripe portal is not available (no customer ID yet), fall back to
      // Apple/Google subscription management pages
      if (typeof window !== 'undefined') {
        window.open('https://apps.apple.com/account/subscriptions', '_blank');
      }
    }
  }

  /**
   * Public `getPaywall` (v0.3.0) — fetch a paywall's declarative template
   * by identifier. Thin wrapper over the existing `getPaywallTemplate`
   * helper but exposed on the public `CapivvPlugin` interface so
   * TypeScript-typed callers can use it.
   */
  async getPaywall(options: { identifier: string }): Promise<PaywallResult> {
    const result = await this.getPaywallTemplate(options.identifier);
    return {
      // v0.5.60 — issue #23. Surface the paywall id so callers can pass it
      // to reportPaywallImpression without hardcoding.
      id: result.id,
      template: result.template,
      version: result.version,
      updatedAt: result.updatedAt,
      cacheTtlSeconds: result.cacheTtlSeconds,
      // v0.5.37 — issue #16. Surface merged variants for app-side analytics.
      appliedVariants: result.appliedVariants ?? [],
    };
  }

  /**
   * v0.5.59 — issue #22. Report that the user was shown a paywall.
   * See CapivvPlugin.reportPaywallImpression for full docs.
   */
  async reportPaywallImpression(options: {
    paywallId: string;
    experimentId?: string;
    variantId?: string;
  }): Promise<{ status: string }> {
    this.ensureConfigured();
    const body: Record<string, unknown> = {};
    if (this.userId) body.user_id = this.userId;
    if (options.experimentId) body.experiment_id = options.experimentId;
    if (options.variantId) body.variant_id = options.variantId;
    const response = await this.apiRequest(
      'POST',
      `/v1/sdk/paywalls/${encodeURIComponent(options.paywallId)}/impressions`,
      body,
    );
    return { status: (response as { status?: string }).status ?? 'recorded' };
  }

  /**
   * Get a paywall template by identifier for OTA updates.
   *
   * Discrimination of failure modes (v0.5.19 fix — customer audit
   * caught that pre-fix this caught everything and silently returned
   * `template: null`, indistinguishable between "no template
   * configured", "auth failed", "server down", and "network down"):
   *
   *   * 404 — clean "no template configured" / "paywall not found".
   *     Returns `{ template: null, ... }`. This is the only case
   *     where falling back to a hardcoded screen is correct.
   *   * 401 / 403 — auth issue (wrong key, key for another tenant,
   *     publishable key trying to read a draft paywall, etc.).
   *     Re-thrown so the caller can show the real error.
   *   * 5xx — backend error. Re-thrown.
   *   * Network failure — re-thrown (not a CapivvApiError).
   *
   * In all non-404 error cases we ALSO log to console at warn level
   * (not just when `debug: true`), so dev-mode tracing is available
   * without flipping a flag. The customer's symptom — `template:
   * null` for hours with no warning anywhere — was caused by this
   * catch swallowing 401s silently.
   */
  async getPaywallTemplate(identifier: string): Promise<TemplateLoadResult> {
    this.ensureConfigured();

    // v0.5.37 — issue #16. Pass user_id when identified so the server can
    // merge active experiment variant.config into the returned template.
    // Without it, the server falls back to the raw template (pre-v0.5.37
    // behavior), so this is fully backward compatible.
    const userQuery = this.userId ? `?user_id=${encodeURIComponent(this.userId)}` : '';

    try {
      const response = await this.apiRequest(
        'GET',
        `/v1/paywalls/by-identifier/${identifier}/template${userQuery}`
      );

      const data = response as Record<string, unknown>;
      return {
        // v0.5.60 — issue #23. Paywall id from the response.
        id: (data.id as string) || '',
        template: data.template as TemplateDefinition | null,
        version: (data.version as string) || '1.0.0',
        updatedAt: (data.updated_at as string) || new Date().toISOString(),
        cacheTtlSeconds: data.cache_ttl_seconds as number | undefined,
        // v0.5.37 — surface which experiment variants were merged so apps
        // can also log them to their own analytics.
        appliedVariants: Array.isArray(data.applied_variants)
          ? (data.applied_variants as Array<Record<string, unknown>>).map((v) => ({
              experimentId: v.experiment_id as string,
              experimentName: v.experiment_name as string,
              variantId: v.variant_id as string,
              variantName: v.variant_name as string,
              isControl: !!v.is_control,
            }))
          : [],
      };
    } catch (e) {
      if (e instanceof CapivvApiError && e.status === 404) {
        if (this.capivvConfig?.debug) {
          console.log(`[Capivv] No template configured for paywall '${identifier}' (404)`);
        }
        return {
          // v0.5.60 — issue #23. No paywall → no id.
          id: '',
          template: null,
          version: '0.0.0',
          updatedAt: new Date().toISOString(),
        };
      }
      console.warn(
        `[Capivv] Failed to fetch paywall template '${identifier}':`,
        e instanceof Error ? `${e.name}: ${e.message}` : e,
      );
      throw e;
    }
  }

  /**
   * Get offerings and template in parallel for a paywall.
   */
  async getPaywallWithTemplate(
    identifier: string
  ): Promise<{ paywallId: string; offerings: Offering[]; template: TemplateDefinition | null }> {
    this.ensureConfigured();

    const [offeringsResult, templateResult] = await Promise.all([
      this.getOfferings(),
      this.getPaywallTemplate(identifier),
    ]);

    return {
      // v0.5.60 — issue #23. Surface the id here too so callers using the
      // combined fetch can report impressions without a second round-trip.
      paywallId: templateResult.id,
      offerings: offeringsResult.offerings,
      template: templateResult.template,
    };
  }

  // Helper methods

  private ensureConfigured(): void {
    if (!this.capivvConfig) {
      throw new Error('Capivv not configured. Call configure() first.');
    }
  }

  private ensureIdentified(): void {
    if (!this.userId) {
      throw new Error('User not identified. Call identify() first.');
    }
  }

  private async apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Capivv-Api-Key': this.capivvConfig!.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      // Throw a typed error with the status code so callers (e.g.
      // `getPaywallTemplate`) can discriminate 404 → graceful fallback
      // from 401/5xx → real failure that the agent should surface.
      throw new CapivvApiError(response.status, error);
    }

    return response.json();
  }

  private mapOffering(offering: Record<string, unknown>): Offering {
    // API returns packages with nested product; flatten to products array
    const packages = (offering.packages as Record<string, unknown>[]) || [];
    const products = packages.map((pkg) => {
      const product = (pkg.product as Record<string, unknown>) || {};
      return {
        identifier: (product.external_id as string) || (pkg.identifier as string),
        title: (product.display_name as string) || '',
        description: (product.description as string) || '',
        priceString: pkg.price ? `${(pkg.price as Record<string, unknown>).formatted || ''}` : '',
        priceAmountMicros: pkg.price
          ? ((pkg.price as Record<string, unknown>).amount_cents as number || 0) * 10000
          : 0,
        currencyCode: pkg.price
          ? ((pkg.price as Record<string, unknown>).currency as string) || 'USD'
          : 'USD',
        productType: (pkg.package_type as ProductType) || ('subscription' as ProductType),
        subscriptionPeriod: undefined as string | undefined,
        trialPeriod: undefined as string | undefined,
      };
    });

    return {
      identifier: offering.identifier as string,
      description: (offering.display_name as string) || (offering.description as string | undefined),
      products,
      metadata: offering.metadata as Record<string, unknown> | undefined,
    };
  }
}

/**
 * v0.5.35 — issue #14. Server returns snake_case; SDK exposes camelCase.
 * Treat missing/null/non-array as empty so older server deploys don't
 * crash newer SDKs and vice versa.
 */
function mapExperimentAssignments(raw: unknown): ExperimentAssignment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    experimentId: r.experiment_id,
    experimentName: r.experiment_name,
    variantId: r.variant_id,
    variantName: r.variant_name,
    isControl: !!r.is_control,
    assignedAt: r.assigned_at,
    // v0.5.40 — issue #18 Primitive 1. Server returns object; coerce
    // missing/null to {} so consumers can always read `.product_override`
    // without null checks.
    config: (r.config && typeof r.config === 'object' ? r.config : {}) as Record<string, unknown>,
  }));
}
