import type { PluginListenerHandle } from '@capacitor/core';
import type { TemplateDefinition } from './templates/types';

/**
 * Product type for purchases
 */
export enum ProductType {
  /** One-time purchase */
  INAPP = 'INAPP',
  /** Subscription */
  SUBSCRIPTION = 'SUBSCRIPTION',
}

/**
 * Purchase state
 */
export enum PurchaseState {
  PENDING = 'PENDING',
  PURCHASED = 'PURCHASED',
  FAILED = 'FAILED',
}

/**
 * Configuration options for initializing the SDK
 */
export interface CapivvConfig {
  /** Your Capivv public API key */
  apiKey: string;
  /** API endpoint URL (optional, defaults to production) */
  apiUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * User attributes for identification
 */
export interface UserAttributes {
  email?: string;
  name?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * A product available for purchase
 */
export interface Product {
  /** Product identifier */
  identifier: string;
  /** Display name */
  title: string;
  /** Product description */
  description: string;
  /** Formatted price string (e.g., "$9.99") */
  priceString: string;
  /** Price in minor units (cents) */
  priceAmountMicros: number;
  /** Currency code (e.g., "USD") */
  currencyCode: string;
  /** Product type */
  productType: ProductType;
  /** Subscription period (for subscriptions) */
  subscriptionPeriod?: string;
  /** Trial period (for subscriptions) */
  trialPeriod?: string;
}

/**
 * An entitlement granted to the user
 */
export interface Entitlement {
  /** Entitlement identifier */
  identifier: string;
  /** Whether the entitlement is currently active */
  isActive: boolean;
  /** When the entitlement expires (ISO date string) */
  expiresAt?: string;
  /** Product that granted this entitlement */
  productIdentifier?: string;
}

/**
 * A completed purchase transaction
 */
export interface Transaction {
  /** Transaction identifier */
  transactionId: string;
  /** Product identifier */
  productIdentifier: string;
  /** Purchase date (ISO string) */
  purchaseDate: string;
  /** Expiration date for subscriptions (ISO string) */
  expirationDate?: string;
  /** Current state of the purchase */
  state: PurchaseState;
  /** Whether the purchase is acknowledged */
  isAcknowledged: boolean;
  /** Receipt data (iOS) */
  receipt?: string;
  /** Purchase token (Android) */
  purchaseToken?: string;
}

/**
 * Offering containing products grouped for presentation
 */
export interface Offering {
  /** Offering identifier */
  identifier: string;
  /** Display description */
  description?: string;
  /** Products in this offering */
  products: Product[];
  /** Metadata from dashboard */
  metadata?: Record<string, unknown>;
}

/**
 * User information including entitlements
 */
export interface UserInfo {
  /** User identifier */
  userId: string;
  /** User's active entitlements */
  entitlements: Entitlement[];
  /** Original purchase date (subscriber since) */
  originalPurchaseDate?: string;
  /** Latest purchase date */
  latestPurchaseDate?: string;
  /**
   * v0.5.35 — variant assignments for every running experiment the user
   * has been bucketed into. Issue #14. Populated on every getUserInfo()
   * / identify() so apps can branch on assignment at boot without a
   * per-experiment lookup. Empty array if no running experiments touch
   * this user. For an explicit per-experiment lookup (which also
   * lazily creates the assignment on first call), use
   * `Capivv.getVariantForExperiment({ experimentId })`.
   */
  experimentAssignments?: ExperimentAssignment[];
}

/**
 * v0.5.35 — a single variant assignment. Issue #14.
 * v0.5.40 — `config` added for #18 Primitive 1
 * (variant.config.product_override). Object shape; `{}` when the
 * variant has no custom config. Read e.g. `config.product_override?.external_id`
 * to branch app behavior per arm without an extra request.
 */
export interface ExperimentAssignment {
  experimentId: string;
  experimentName: string;
  variantId: string;
  variantName: string;
  isControl: boolean;
  assignedAt: string;
  config: Record<string, unknown>;
}

/**
 * v0.5.35 — result of a per-experiment variant lookup. Issue #14.
 *
 * When the experiment isn't running (draft / paused / completed), every
 * field below variantId is null — distinguishes "no arm yet" from "no
 * experiment found" (which throws 404 via CapivvApiError instead).
 */
export interface VariantAssignment {
  experimentId: string;
  variantId: string | null;
  variantName: string | null;
  isControl: boolean | null;
  /**
   * v0.5.40 — the variant's `config` JSON. Issue #18 Primitive 1. `null`
   * only when the experiment isn't running. Read `config.product_override?.external_id`
   * to assign different Apple SKUs per arm (the pricing-A/B pattern), or
   * any other custom key the experiment author wrote at create time.
   * For a pre-resolved product id, see `Capivv.getAssignedProductForExperiment`.
   */
  config: Record<string, unknown> | null;
}

/**
 * v0.5.44 — result of `Capivv.getPromotionalOfferForExperiment`. Issue #18
 * Primitive 3. Apple-signed promotional offer payload. App passes
 * these four fields to `SKMutablePayment.paymentDiscount` (iOS) or
 * the Android equivalent at purchase time.
 *
 * `signatureBase64` is the ECDSA-P256 signature over the canonical
 * payload (appBundleID + keyIdentifier + productIdentifier +
 * offerIdentifier + lowercased applicationUsername + nonce + timestamp,
 * separated by U+2063). Apple's StoreKit verifies it against the
 * customer's public key on file. Signatures expire after ~24h per
 * Apple's spec.
 */
export interface PromotionalOfferPayload {
  keyIdentifier: string;
  nonce: string;
  timestampMs: string;
  signatureBase64: string;
}

/**
 * v0.5.40 — result of `Capivv.getAssignedProductForExperiment`. Issue #18
 * Primitive 1. Convenience helper that resolves `variant.config.product_override`
 * to a concrete product identifier the app can pass to `Capivv.purchase`.
 *
 * `productId` is the override's `external_id` when the variant has one,
 * otherwise the `fallbackProductId` the caller supplied. `source`
 * disambiguates which path was taken so the app can log it for analytics.
 */
export interface AssignedProduct {
  productId: string;
  source: 'variant_override' | 'fallback';
  variantId: string | null;
  variantName: string | null;
  isControl: boolean | null;
}

/**
 * Result of checking if a feature is unlocked
 */
export interface EntitlementCheckResult {
  /** Whether the user has access */
  hasAccess: boolean;
  /** The entitlement if found */
  entitlement?: Entitlement;
}

/**
 * Error thrown by Capivv SDK API calls when the backend returns a
 * non-success HTTP status. Has a `status` field so callers can branch
 * on auth vs server errors instead of pattern-matching on the message.
 *
 * v0.5.19 — added so `Capivv.getPaywall(...)` and friends can be more
 * discriminating about which errors deserve a `template: null` graceful
 * fallback (only 404) vs which should propagate (401/403/5xx). Web
 * callers can `import { CapivvApiError } from '@capivv/capacitor-sdk'`
 * and `instanceof` check.
 */
export class CapivvApiError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string) {
    super(`Capivv API error (${status}): ${body}`);
    this.name = 'CapivvApiError';
    this.status = status;
    this.body = body;
    // Preserve prototype chain for `instanceof` after transpilation.
    Object.setPrototypeOf(this, CapivvApiError.prototype);
  }
}

/**
 * Result of fetching a paywall config from Capivv. The `template` is the
 * declarative `TemplateDefinition` that `<DynamicPaywall>` renders.
 *
 * `template` is null when no template has been configured for the
 * paywall identifier (caller should fall back to a hardcoded screen).
 */
export interface PaywallResult {
  /** Declarative paywall config; pass to `<DynamicPaywall template={...}>`. */
  template: TemplateDefinition | null;
  /** Template version, useful for cache invalidation. */
  version: string;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
  /**
   * Suggested cache TTL in seconds. Clients can cache the result this
   * long before re-fetching. Undefined means no recommended TTL.
   */
  cacheTtlSeconds?: number;
  /**
   * v0.5.37 — issue #16. Variants that were merged into `template` for
   * this user. Empty when the SDK isn't identified at fetch time or no
   * running experiment is scoped to this paywall. Apps can log these
   * to their own analytics to track which arm rendered. The user is
   * already in the assignment table; this field is just the visible
   * surface for app-side telemetry.
   */
  appliedVariants?: AppliedVariant[];
}

/**
 * v0.5.37 — issue #16. A single variant whose config was merged into a
 * paywall template.
 */
export interface AppliedVariant {
  experimentId: string;
  experimentName: string;
  variantId: string;
  variantName: string;
  isControl: boolean;
}

/**
 * Result of a purchase operation
 */
export interface PurchaseResult {
  /** Whether the purchase succeeded */
  success: boolean;
  /** The transaction details */
  transaction?: Transaction;
  /** Error message if failed */
  error?: string;
}

/**
 * Event emitted when entitlements change
 */
export interface EntitlementsUpdatedEvent {
  entitlements: Entitlement[];
}

/**
 * Event emitted when a purchase completes
 */
export interface PurchaseCompletedEvent {
  transaction: Transaction;
}

/**
 * Event emitted when a purchase fails
 */
export interface PurchaseFailedEvent {
  productIdentifier: string;
  error: string;
}

/**
 * Capivv Plugin Interface
 *
 * The Capivv Capacitor plugin provides subscription management
 * and in-app purchase functionality for iOS and Android.
 */
export interface CapivvPlugin {
  /**
   * Configure and initialize the SDK.
   * Must be called before any other methods.
   *
   * @param config - Configuration options
   * @returns Promise that resolves when initialization is complete
   */
  configure(config: CapivvConfig): Promise<void>;

  /**
   * Identify the current user.
   * Creates the user in Capivv if they don't exist.
   *
   * @param options - User identification options
   * @returns Promise with user information
   */
  /**
   * Identify the current user.
   *
   * v0.5.51 — `preExperimentCovariates` accepts a map of named numeric
   * covariates (e.g. `{ lifetime_revenue_28d: 12.5 }`) for CUPED
   * variance reduction on Bayesian posteriors (#18 analysis surface
   * slice 4). The backend UPSERTs by (user, covariate_name) so
   * re-identifying with the same key overwrites with the latest
   * value. Omit when you don't have one — posteriors fall back to
   * the v0.5.45 binary-conversion math.
   */
  identify(options: {
    userId: string;
    attributes?: UserAttributes;
    preExperimentCovariates?: Record<string, number>;
  }): Promise<UserInfo>;

  /**
   * Log out the current user.
   * Clears cached data and resets to anonymous state.
   *
   * @returns Promise that resolves when logout is complete
   */
  logout(): Promise<void>;

  /**
   * Get the current user's information.
   *
   * @returns Promise with user information
   */
  getUserInfo(): Promise<UserInfo>;

  /**
   * v0.5.35 — fetch which variant a user is in for a given experiment.
   * Issue #14.
   *
   * On first call for a (user, experiment) pair the server lazily
   * creates a deterministic bucket assignment honoring the experiment's
   * variant traffic_percent split. Subsequent calls return the same
   * variant — assignment is stable across SDK boots and even across
   * `identify` re-runs (it's keyed on the user's external_id, not the
   * internal app_user row).
   *
   * Returns `variantId: null` (still HTTP 200) if the experiment isn't
   * running (draft / paused / completed). Throws 404 via CapivvApiError
   * if the experiment doesn't exist. Throws if the SDK isn't
   * configured or identified.
   *
   * For reading *all* current assignments at once (e.g. at boot, no
   * server round-trip per experiment), read `userInfo.experimentAssignments`
   * after `identify()` / `getUserInfo()` instead.
   *
   * @example
   * ```ts
   * const { variantName, isControl } = await Capivv.getVariantForExperiment({
   *   experimentId: 'b410469c-7df5-45ba-acdb-c8fa4183aa23',
   * });
   * const defaultPlan = variantName === 'annual_default' ? 'annual' : 'monthly';
   * ```
   */
  getVariantForExperiment(options: { experimentId: string }): Promise<VariantAssignment>;

  /**
   * v0.5.40 — issue #18 Primitive 1. Resolves which product the current
   * user should be charged for a pricing-A/B experiment.
   *
   * Reads `config.product_override.external_id` from the assigned
   * variant; falls back to `fallbackProductId` when the variant is the
   * control, has no override set, or the experiment isn't running.
   *
   * @example
   * ```ts
   * const { productId } = await Capivv.getAssignedProductForExperiment({
   *   experimentId: 'price-monthly-tier-test-v1',
   *   fallbackProductId: 'com.interrrupt.app.pro.monthly',
   * });
   * await Capivv.purchase({ productIdentifier: productId });
   * ```
   */
  /**
   * v0.5.44 — issue #18 Primitive 3. Fetches a signed Apple promotional
   * offer payload tied to the user's variant assignment. The variant
   * config must carry `promotional_offer_config.offer_identifier`
   * (configured in App Store Connect under the subscription's
   * promotional offers). The customer's promotional-offer signing key
   * (separate from the ASC API key) must be uploaded via the dashboard.
   *
   * Returns 404 if the variant has no offer configured (control arm or
   * experiment not running). Returns 400 if the signing key isn't
   * uploaded yet — error body says exactly what's missing.
   *
   * @example
   * ```ts
   * const offer = await Capivv.getPromotionalOfferForExperiment({
   *   experimentId: 'price-monthly-tier-test-v1',
   * });
   * // iOS / Capacitor StoreKit2: pass offer.* into SKMutablePayment.paymentDiscount.
   * ```
   */
  getPromotionalOfferForExperiment(options: {
    experimentId: string;
    /** Override the product identifier (rarely needed — the variant config or product_override usually carries it). */
    productIdentifier?: string;
  }): Promise<PromotionalOfferPayload>;

  getAssignedProductForExperiment(options: {
    experimentId: string;
    fallbackProductId: string;
    /**
     * v0.5.42 — issue #18 Primitive 2. When the variant's
     * `config.product_override.country_codes` array is set, the override
     * only applies if the user's country is in the list. Useful for
     * country-scoped pricing A/Bs (e.g. lower-priced BR-only tier).
     * Omit to ignore country filtering (matches v0.5.41 behavior —
     * override applies everywhere).
     *
     * Pass the StoreKit storefront country code (e.g. "BR", "PT"); the
     * SDK doesn't auto-detect because Capacitor doesn't expose a
     * cross-platform storefront API. iOS apps can read it via
     * `SKStorefront.current.countryCode`; web/Android typically have
     * the value from prior identify metadata or geo lookup.
     */
    countryCode?: string;
  }): Promise<AssignedProduct>;

  /**
   * Check if billing is supported on this device.
   *
   * @returns Promise with billing support status
   */
  isBillingSupported(): Promise<{ isSupported: boolean }>;

  /**
   * Get available offerings.
   * Offerings group products for presentation.
   *
   * @returns Promise with list of offerings
   */
  getOfferings(): Promise<{ offerings: Offering[] }>;

  /**
   * Fetch a paywall's declarative `TemplateDefinition` by identifier.
   *
   * Pair this with `<DynamicPaywall template={result.template} />` from
   * `@capivv/capacitor-react` to render a paywall whose copy, layout,
   * and theme can be edited from the Capivv dashboard / MCP without
   * shipping a new app build.
   *
   * Returns `template: null` if no template is configured for the
   * identifier (caller should fall back to a hardcoded screen).
   * Throws if the SDK isn't configured or the network call fails.
   *
   * @example
   * ```ts
   * const { template } = await Capivv.getPaywall({ identifier: 'pro' });
   * if (template) {
   *   return <DynamicPaywall template={template} offerings={offerings} ... />;
   * }
   * ```
   */
  getPaywall(options: { identifier: string }): Promise<PaywallResult>;

  /**
   * Get a specific product by identifier.
   *
   * @param options - Product query options
   * @returns Promise with product details
   */
  getProduct(options: {
    productIdentifier: string;
    productType?: ProductType;
  }): Promise<{ product: Product }>;

  /**
   * Get multiple products by identifier.
   *
   * @param options - Products query options
   * @returns Promise with product list
   */
  getProducts(options: {
    productIdentifiers: string[];
    productType?: ProductType;
  }): Promise<{ products: Product[] }>;

  /**
   * Purchase a product.
   *
   * @param options - Purchase options
   * @returns Promise with purchase result
   */
  purchase(options: {
    productIdentifier: string;
    productType?: ProductType;
    /** For subscription plan selection (Android) */
    planIdentifier?: string;
    /** Quantity for consumables */
    quantity?: number;
  }): Promise<PurchaseResult>;

  /**
   * Restore previous purchases.
   * Useful for users who reinstall the app or switch devices.
   *
   * @returns Promise with restored entitlements
   */
  restorePurchases(): Promise<{ entitlements: Entitlement[] }>;

  /**
   * Check if the user has access to a specific entitlement.
   *
   * @param options - Entitlement check options
   * @returns Promise with access status
   */
  checkEntitlement(options: {
    entitlementIdentifier: string;
  }): Promise<EntitlementCheckResult>;

  /**
   * Get all active entitlements for the current user.
   *
   * @returns Promise with active entitlements
   */
  getEntitlements(): Promise<{ entitlements: Entitlement[] }>;

  /**
   * Sync purchases with the server.
   * Call this after app launch to ensure entitlements are up to date.
   *
   * @returns Promise with synced entitlements
   */
  syncPurchases(): Promise<{ entitlements: Entitlement[] }>;

  /**
   * Present the platform-specific subscription management UI.
   * On iOS, opens the App Store subscription management.
   * On Android, opens Google Play subscription management.
   *
   * @returns Promise that resolves when management UI is shown
   */
  manageSubscriptions(): Promise<void>;

  /**
   * Listen for entitlement updates.
   *
   * @param eventName - Event name
   * @param listenerFunc - Callback function
   * @returns Promise with listener handle for removal
   */
  addListener(
    eventName: 'entitlementsUpdated',
    listenerFunc: (event: EntitlementsUpdatedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Listen for purchase completion.
   *
   * @param eventName - Event name
   * @param listenerFunc - Callback function
   * @returns Promise with listener handle for removal
   */
  addListener(
    eventName: 'purchaseCompleted',
    listenerFunc: (event: PurchaseCompletedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Listen for purchase failures.
   *
   * @param eventName - Event name
   * @param listenerFunc - Callback function
   * @returns Promise with listener handle for removal
   */
  addListener(
    eventName: 'purchaseFailed',
    listenerFunc: (event: PurchaseFailedEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners for this plugin.
   *
   * @returns Promise that resolves when listeners are removed
   */
  removeAllListeners(): Promise<void>;
}
