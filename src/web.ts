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
 * Uses the Capivv REST API directly for web platforms.
 * Stripe integration can be added for web purchases.
 */
export class CapivvWeb extends WebPlugin implements CapivvPlugin {
  private config: CapivvConfig | null = null;
  private userId: string | null = null;
  private apiUrl: string = 'https://api.capivv.com';

  async configure(config: CapivvConfig): Promise<void> {
    this.config = config;
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

    const response = await this.apiRequest('POST', `/v1/users/${options.userId}/login`, {
      attributes: options.attributes,
    });

    return {
      userId: options.userId,
      entitlements: response.entitlements || [],
      originalPurchaseDate: response.original_purchase_date,
      latestPurchaseDate: response.latest_purchase_date,
    };
  }

  async logout(): Promise<void> {
    this.userId = null;
  }

  async getUserInfo(): Promise<UserInfo> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/users/${this.userId}/entitlements`);

    return {
      userId: this.userId!,
      entitlements: response.entitlements || [],
    };
  }

  async isBillingSupported(): Promise<{ isSupported: boolean }> {
    // Web platform always supports billing via Stripe
    return { isSupported: true };
  }

  async getOfferings(): Promise<{ offerings: Offering[] }> {
    this.ensureConfigured();

    const response = await this.apiRequest('GET', '/v1/offerings');

    return {
      offerings: (response.offerings || []).map(this.mapOffering),
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

    // For web, we would integrate with Stripe Checkout here
    // This is a placeholder that returns an error suggesting native platforms
    console.warn(
      '[Capivv] Web purchases require Stripe integration. Configure Stripe in your Capivv dashboard.',
    );

    // TODO: Implement Stripe Checkout integration
    // 1. Create checkout session via Capivv API
    // 2. Redirect to Stripe Checkout
    // 3. Handle success/cancel callbacks

    return {
      success: false,
      error: 'Web purchases not yet implemented. Use iOS or Android for native purchases.',
    };
  }

  async restorePurchases(): Promise<{ entitlements: Entitlement[] }> {
    this.ensureConfigured();
    this.ensureIdentified();

    // Web doesn't have local purchases to restore
    // Just fetch current entitlements from server
    const response = await this.apiRequest('GET', `/v1/users/${this.userId}/entitlements`);

    return {
      entitlements: response.entitlements || [],
    };
  }

  async checkEntitlement(options: {
    entitlementIdentifier: string;
  }): Promise<EntitlementCheckResult> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/users/${this.userId}/entitlements`);
    const entitlements: Entitlement[] = response.entitlements || [];

    const entitlement = entitlements.find((e) => e.identifier === options.entitlementIdentifier);

    return {
      hasAccess: entitlement?.isActive ?? false,
      entitlement,
    };
  }

  async getEntitlements(): Promise<{ entitlements: Entitlement[] }> {
    this.ensureConfigured();
    this.ensureIdentified();

    const response = await this.apiRequest('GET', `/v1/users/${this.userId}/entitlements`);

    return {
      entitlements: response.entitlements || [],
    };
  }

  async syncPurchases(): Promise<{ entitlements: Entitlement[] }> {
    // Web doesn't have local purchases to sync
    return this.getEntitlements();
  }

  async manageSubscriptions(): Promise<void> {
    // For web, we could redirect to a customer portal
    // For now, log a warning
    console.warn(
      '[Capivv] Subscription management on web requires Stripe Customer Portal integration.',
    );
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
      if (this.config?.debug) {
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
    if (!this.config) {
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
      'X-Capivv-Api-Key': this.config!.apiKey,
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
    return {
      identifier: offering.identifier as string,
      description: offering.description as string | undefined,
      products: ((offering.products as Record<string, unknown>[]) || []).map((p) => ({
        identifier: p.identifier as string,
        title: p.title as string,
        description: p.description as string,
        priceString: p.price_string as string,
        priceAmountMicros: p.price_amount_micros as number,
        currencyCode: p.currency_code as string,
        productType: p.product_type as ProductType,
        subscriptionPeriod: p.subscription_period as string | undefined,
        trialPeriod: p.trial_period as string | undefined,
      })),
      metadata: offering.metadata as Record<string, unknown> | undefined,
    };
  }
}
