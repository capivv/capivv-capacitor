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
} from './definitions';
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

  async identify(options: { userId: string; attributes?: UserAttributes }): Promise<UserInfo> {
    this.ensureConfigured();
    this.userId = options.userId;

    const response = await this.apiRequest('POST', `/v1/sdk/users`, {
      external_id: options.userId,
      attributes: options.attributes,
    });

    const data = response as any;
    return {
      userId: options.userId,
      entitlements: data.entitlements || [],
      originalPurchaseDate: data.original_purchase_date,
      latestPurchaseDate: data.latest_purchase_date,
    };
  }

  async logout(): Promise<void> {
    this.userId = null;
  }

  async getUserInfo(): Promise<UserInfo> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/sdk/users/${this.userId}/entitlements`);

    const data = response as any;
    return {
      userId: this.userId!,
      entitlements: data.entitlements || [],
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
   * Get a paywall template by identifier for OTA updates.
   */
  async getPaywallTemplate(identifier: string): Promise<TemplateLoadResult> {
    this.ensureConfigured();

    try {
      const response = await this.apiRequest(
        'GET',
        `/v1/paywalls/by-identifier/${identifier}/template`
      );

      const data = response as Record<string, unknown>;
      return {
        template: data.template as TemplateDefinition | null,
        version: (data.version as string) || '1.0.0',
        updatedAt: (data.updated_at as string) || new Date().toISOString(),
        cacheTtlSeconds: data.cache_ttl_seconds as number | undefined,
      };
    } catch (e) {
      if (this.capivvConfig?.debug) {
        console.log(`[Capivv] Template not available for ${identifier}:`, e);
      }
      // Return empty result for graceful fallback
      return {
        template: null,
        version: '0.0.0',
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get offerings and template in parallel for a paywall.
   */
  async getPaywallWithTemplate(
    identifier: string
  ): Promise<{ offerings: Offering[]; template: TemplateDefinition | null }> {
    this.ensureConfigured();

    const [offeringsResult, templateResult] = await Promise.all([
      this.getOfferings(),
      this.getPaywallTemplate(identifier),
    ]);

    return {
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
      throw new Error(`API error (${response.status}): ${error}`);
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
