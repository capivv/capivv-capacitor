import type { PluginListenerHandle } from '@capacitor/core';

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
  identify(options: { userId: string; attributes?: UserAttributes }): Promise<UserInfo>;

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
