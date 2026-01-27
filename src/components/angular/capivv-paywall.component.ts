import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Capivv, Product, Offering, PurchaseResult, ProductType } from '../../index';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Capivv Paywall Component for Ionic Angular
 *
 * A ready-to-use paywall component that displays available products
 * and handles the purchase flow.
 *
 * @example
 * ```html
 * <capivv-paywall
 *   [offeringId]="'default'"
 *   [showRestoreButton]="true"
 *   (purchaseComplete)="onPurchaseComplete($event)"
 *   (purchaseFailed)="onPurchaseFailed($event)"
 *   (dismiss)="closePaywall()">
 * </capivv-paywall>
 * ```
 */
@Component({
  selector: 'capivv-paywall',
  template: `
    <ion-content class="capivv-paywall" [class.dark]="darkMode">
      <div class="paywall-container">
        <!-- Header -->
        <div class="paywall-header">
          <ion-button *ngIf="showCloseButton" fill="clear" (click)="onDismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
          <h1 class="paywall-title">{{ title }}</h1>
          <p class="paywall-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="paywall-loading">
          <ion-spinner></ion-spinner>
          <p>Loading products...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error" class="paywall-error">
          <ion-icon name="alert-circle-outline" color="danger"></ion-icon>
          <p>{{ error }}</p>
          <ion-button (click)="loadProducts()">Retry</ion-button>
        </div>

        <!-- Products -->
        <div *ngIf="!loading && !error" class="paywall-products">
          <ion-card
            *ngFor="let product of products"
            [class.selected]="selectedProduct?.identifier === product.identifier"
            (click)="selectProduct(product)"
            button>
            <ion-card-header>
              <ion-card-title>{{ product.title }}</ion-card-title>
              <ion-card-subtitle *ngIf="product.subscriptionPeriod">
                {{ product.subscriptionPeriod }}
              </ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p class="product-description">{{ product.description }}</p>
              <div class="product-price">
                <span class="price">{{ product.priceString }}</span>
                <span *ngIf="product.trialPeriod" class="trial-badge">
                  {{ product.trialPeriod }} free trial
                </span>
              </div>
            </ion-card-content>
            <ion-icon
              *ngIf="selectedProduct?.identifier === product.identifier"
              name="checkmark-circle"
              color="primary"
              class="selected-icon">
            </ion-icon>
          </ion-card>
        </div>

        <!-- Features List -->
        <div *ngIf="features.length > 0" class="paywall-features">
          <h3>What you'll get:</h3>
          <ion-list lines="none">
            <ion-item *ngFor="let feature of features">
              <ion-icon name="checkmark-circle" color="success" slot="start"></ion-icon>
              <ion-label>{{ feature }}</ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- Purchase Button -->
        <div class="paywall-actions">
          <ion-button
            expand="block"
            size="large"
            [disabled]="!selectedProduct || purchasing"
            (click)="purchase()">
            <ion-spinner *ngIf="purchasing"></ion-spinner>
            <span *ngIf="!purchasing">
              {{ purchaseButtonText || 'Subscribe Now' }}
            </span>
          </ion-button>

          <ion-button
            *ngIf="showRestoreButton"
            expand="block"
            fill="clear"
            (click)="restore()"
            [disabled]="restoring">
            <ion-spinner *ngIf="restoring" name="dots"></ion-spinner>
            <span *ngIf="!restoring">Restore Purchases</span>
          </ion-button>
        </div>

        <!-- Footer -->
        <div class="paywall-footer">
          <p class="terms-text">
            <a (click)="openTerms()">Terms of Service</a> •
            <a (click)="openPrivacy()">Privacy Policy</a>
          </p>
          <p class="subscription-terms" *ngIf="selectedProduct?.productType === 'SUBSCRIPTION'">
            Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
          </p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .capivv-paywall {
      --background: var(--ion-background-color, #ffffff);
    }

    .capivv-paywall.dark {
      --background: var(--ion-background-color, #1a1a1a);
    }

    .paywall-container {
      padding: 16px;
      max-width: 500px;
      margin: 0 auto;
    }

    .paywall-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .paywall-title {
      font-size: 24px;
      font-weight: 700;
      margin: 16px 0 8px;
    }

    .paywall-subtitle {
      font-size: 16px;
      color: var(--ion-color-medium);
      margin: 0;
    }

    .paywall-loading,
    .paywall-error {
      text-align: center;
      padding: 48px 16px;
    }

    .paywall-error ion-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .paywall-products {
      margin-bottom: 24px;
    }

    ion-card {
      margin: 12px 0;
      position: relative;
      border: 2px solid transparent;
      transition: border-color 0.2s ease;
    }

    ion-card.selected {
      border-color: var(--ion-color-primary);
    }

    .selected-icon {
      position: absolute;
      top: 12px;
      right: 12px;
      font-size: 24px;
    }

    .product-description {
      color: var(--ion-color-medium);
      margin-bottom: 12px;
    }

    .product-price {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .price {
      font-size: 20px;
      font-weight: 700;
      color: var(--ion-color-primary);
    }

    .trial-badge {
      background: var(--ion-color-success);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .paywall-features {
      margin-bottom: 24px;
    }

    .paywall-features h3 {
      margin-bottom: 12px;
      font-weight: 600;
    }

    .paywall-actions {
      margin-bottom: 24px;
    }

    .paywall-actions ion-button {
      margin-bottom: 8px;
    }

    .paywall-footer {
      text-align: center;
    }

    .terms-text {
      font-size: 14px;
      color: var(--ion-color-medium);
    }

    .terms-text a {
      color: var(--ion-color-primary);
      cursor: pointer;
    }

    .subscription-terms {
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-top: 8px;
    }
  `]
})
export class CapivvPaywallComponent implements OnInit, OnDestroy {
  /** The offering ID to display products from */
  @Input() offeringId: string = 'default';

  /** Title displayed at the top of the paywall */
  @Input() title: string = 'Unlock Premium';

  /** Subtitle displayed below the title */
  @Input() subtitle: string = '';

  /** Whether to show the close button */
  @Input() showCloseButton: boolean = true;

  /** Whether to show the restore purchases button */
  @Input() showRestoreButton: boolean = true;

  /** List of features to display */
  @Input() features: string[] = [];

  /** Custom text for the purchase button */
  @Input() purchaseButtonText: string = '';

  /** URL for terms of service */
  @Input() termsUrl: string = '';

  /** URL for privacy policy */
  @Input() privacyUrl: string = '';

  /** Enable dark mode styling */
  @Input() darkMode: boolean = false;

  /** Emitted when a purchase completes successfully */
  @Output() purchaseComplete = new EventEmitter<PurchaseResult>();

  /** Emitted when a purchase fails */
  @Output() purchaseFailed = new EventEmitter<{ error: string }>();

  /** Emitted when purchases are restored */
  @Output() restoreComplete = new EventEmitter<void>();

  /** Emitted when the paywall is dismissed */
  @Output() dismiss = new EventEmitter<void>();

  products: Product[] = [];
  selectedProduct: Product | null = null;
  loading = true;
  error: string | null = null;
  purchasing = false;
  restoring = false;

  private listeners: PluginListenerHandle[] = [];

  async ngOnInit() {
    await this.loadProducts();
    await this.setupListeners();
  }

  ngOnDestroy() {
    this.listeners.forEach(listener => listener.remove());
  }

  async loadProducts() {
    this.loading = true;
    this.error = null;

    try {
      const { offerings } = await Capivv.getOfferings();
      const offering = offerings.find(o => o.identifier === this.offeringId) || offerings[0];

      if (offering) {
        this.products = offering.products;
        if (this.products.length > 0) {
          this.selectedProduct = this.products[0];
        }
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load products';
    } finally {
      this.loading = false;
    }
  }

  private async setupListeners() {
    const purchaseListener = await Capivv.addListener('purchaseCompleted', (event) => {
      this.purchasing = false;
      this.purchaseComplete.emit({ success: true, transaction: event.transaction });
    });
    this.listeners.push(purchaseListener);

    const failedListener = await Capivv.addListener('purchaseFailed', (event) => {
      this.purchasing = false;
      this.purchaseFailed.emit({ error: event.error });
    });
    this.listeners.push(failedListener);
  }

  selectProduct(product: Product) {
    this.selectedProduct = product;
  }

  async purchase() {
    if (!this.selectedProduct) return;

    this.purchasing = true;

    try {
      const result = await Capivv.purchase({
        productIdentifier: this.selectedProduct.identifier,
        productType: this.selectedProduct.productType as ProductType,
      });

      if (result.success) {
        this.purchaseComplete.emit(result);
      } else {
        this.purchaseFailed.emit({ error: result.error || 'Purchase failed' });
      }
    } catch (e) {
      this.purchaseFailed.emit({ error: e instanceof Error ? e.message : 'Purchase failed' });
    } finally {
      this.purchasing = false;
    }
  }

  async restore() {
    this.restoring = true;

    try {
      await Capivv.restorePurchases();
      this.restoreComplete.emit();
    } catch (e) {
      this.purchaseFailed.emit({ error: e instanceof Error ? e.message : 'Restore failed' });
    } finally {
      this.restoring = false;
    }
  }

  onDismiss() {
    this.dismiss.emit();
  }

  openTerms() {
    if (this.termsUrl) {
      window.open(this.termsUrl, '_blank');
    }
  }

  openPrivacy() {
    if (this.privacyUrl) {
      window.open(this.privacyUrl, '_blank');
    }
  }
}
