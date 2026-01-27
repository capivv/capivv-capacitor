<template>
  <ion-content :class="['capivv-paywall', { dark: darkMode }]">
    <div class="paywall-container">
      <!-- Header -->
      <div class="paywall-header">
        <ion-button v-if="showCloseButton" fill="clear" @click="$emit('dismiss')">
          <ion-icon :icon="closeOutline"></ion-icon>
        </ion-button>
        <h1 class="paywall-title">{{ title }}</h1>
        <p v-if="subtitle" class="paywall-subtitle">{{ subtitle }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="paywall-loading">
        <ion-spinner></ion-spinner>
        <p>Loading products...</p>
      </div>

      <!-- Error State -->
      <div v-if="error" class="paywall-error">
        <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
        <p>{{ error }}</p>
        <ion-button @click="loadProducts">Retry</ion-button>
      </div>

      <!-- Products -->
      <div v-if="!loading && !error" class="paywall-products">
        <ion-card
          v-for="product in products"
          :key="product.identifier"
          :class="{ selected: selectedProduct?.identifier === product.identifier }"
          button
          @click="selectProduct(product)"
        >
          <ion-card-header>
            <ion-card-title>{{ product.title }}</ion-card-title>
            <ion-card-subtitle v-if="product.subscriptionPeriod">
              {{ product.subscriptionPeriod }}
            </ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <p class="product-description">{{ product.description }}</p>
            <div class="product-price">
              <span class="price">{{ product.priceString }}</span>
              <span v-if="product.trialPeriod" class="trial-badge">
                {{ product.trialPeriod }} free trial
              </span>
            </div>
          </ion-card-content>
          <ion-icon
            v-if="selectedProduct?.identifier === product.identifier"
            :icon="checkmarkCircle"
            color="primary"
            class="selected-icon"
          ></ion-icon>
        </ion-card>
      </div>

      <!-- Features List -->
      <div v-if="features.length > 0" class="paywall-features">
        <h3>What you'll get:</h3>
        <ion-list lines="none">
          <ion-item v-for="(feature, index) in features" :key="index">
            <ion-icon :icon="checkmarkCircle" color="success" slot="start"></ion-icon>
            <ion-label>{{ feature }}</ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Purchase Button -->
      <div class="paywall-actions">
        <ion-button
          expand="block"
          size="large"
          :disabled="!selectedProduct || purchasing"
          @click="purchase"
        >
          <ion-spinner v-if="purchasing"></ion-spinner>
          <span v-else>{{ purchaseButtonText || 'Subscribe Now' }}</span>
        </ion-button>

        <ion-button
          v-if="showRestoreButton"
          expand="block"
          fill="clear"
          :disabled="restoring"
          @click="restore"
        >
          <ion-spinner v-if="restoring" name="dots"></ion-spinner>
          <span v-else>Restore Purchases</span>
        </ion-button>
      </div>

      <!-- Footer -->
      <div class="paywall-footer">
        <p class="terms-text">
          <a v-if="termsUrl" @click="openTerms">Terms of Service</a>
          <span v-if="termsUrl && privacyUrl"> • </span>
          <a v-if="privacyUrl" @click="openPrivacy">Privacy Policy</a>
        </p>
        <p v-if="selectedProduct?.productType === 'SUBSCRIPTION'" class="subscription-terms">
          Subscription automatically renews unless cancelled at least 24 hours before the end of the
          current period.
        </p>
      </div>
    </div>
  </ion-content>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, PropType } from 'vue';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import { closeOutline, checkmarkCircle, alertCircleOutline } from 'ionicons/icons';
import { Capivv, Product, Offering, PurchaseResult, ProductType } from '../../index';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Capivv Paywall Component for Ionic Vue
 *
 * A ready-to-use paywall component that displays available products
 * and handles the purchase flow.
 *
 * @example
 * ```vue
 * <CapivvPaywall
 *   offering-id="default"
 *   :show-restore-button="true"
 *   @purchase-complete="onPurchaseComplete"
 *   @dismiss="closePaywall"
 * />
 * ```
 */
export default defineComponent({
  name: 'CapivvPaywall',
  components: {
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
  },
  props: {
    /** The offering ID to display products from */
    offeringId: {
      type: String,
      default: 'default',
    },
    /** Title displayed at the top of the paywall */
    title: {
      type: String,
      default: 'Unlock Premium',
    },
    /** Subtitle displayed below the title */
    subtitle: {
      type: String,
      default: '',
    },
    /** Whether to show the close button */
    showCloseButton: {
      type: Boolean,
      default: true,
    },
    /** Whether to show the restore purchases button */
    showRestoreButton: {
      type: Boolean,
      default: true,
    },
    /** List of features to display */
    features: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    /** Custom text for the purchase button */
    purchaseButtonText: {
      type: String,
      default: 'Subscribe Now',
    },
    /** URL for terms of service */
    termsUrl: {
      type: String,
      default: '',
    },
    /** URL for privacy policy */
    privacyUrl: {
      type: String,
      default: '',
    },
    /** Enable dark mode styling */
    darkMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['purchase-complete', 'purchase-failed', 'restore-complete', 'dismiss'],
  setup(props, { emit }) {
    const products = ref<Product[]>([]);
    const selectedProduct = ref<Product | null>(null);
    const loading = ref(true);
    const error = ref<string | null>(null);
    const purchasing = ref(false);
    const restoring = ref(false);
    const listeners = ref<PluginListenerHandle[]>([]);

    const loadProducts = async () => {
      loading.value = true;
      error.value = null;

      try {
        const { offerings } = await Capivv.getOfferings();
        const offering =
          offerings.find((o: Offering) => o.identifier === props.offeringId) || offerings[0];

        if (offering) {
          products.value = offering.products;
          if (offering.products.length > 0) {
            selectedProduct.value = offering.products[0];
          }
        }
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load products';
      } finally {
        loading.value = false;
      }
    };

    const setupListeners = async () => {
      const purchaseListener = await Capivv.addListener('purchaseCompleted', (event) => {
        purchasing.value = false;
        emit('purchase-complete', { success: true, transaction: event.transaction });
      });
      listeners.value.push(purchaseListener);

      const failedListener = await Capivv.addListener('purchaseFailed', (event) => {
        purchasing.value = false;
        emit('purchase-failed', { error: event.error });
      });
      listeners.value.push(failedListener);
    };

    const selectProduct = (product: Product) => {
      selectedProduct.value = product;
    };

    const purchase = async () => {
      if (!selectedProduct.value) return;

      purchasing.value = true;

      try {
        const result = await Capivv.purchase({
          productIdentifier: selectedProduct.value.identifier,
          productType: selectedProduct.value.productType as ProductType,
        });

        if (result.success) {
          emit('purchase-complete', result);
        } else {
          emit('purchase-failed', { error: result.error || 'Purchase failed' });
        }
      } catch (e) {
        emit('purchase-failed', { error: e instanceof Error ? e.message : 'Purchase failed' });
      } finally {
        purchasing.value = false;
      }
    };

    const restore = async () => {
      restoring.value = true;

      try {
        await Capivv.restorePurchases();
        emit('restore-complete');
      } catch (e) {
        emit('purchase-failed', { error: e instanceof Error ? e.message : 'Restore failed' });
      } finally {
        restoring.value = false;
      }
    };

    const openTerms = () => {
      if (props.termsUrl) {
        window.open(props.termsUrl, '_blank');
      }
    };

    const openPrivacy = () => {
      if (props.privacyUrl) {
        window.open(props.privacyUrl, '_blank');
      }
    };

    onMounted(async () => {
      await loadProducts();
      await setupListeners();
    });

    onUnmounted(() => {
      listeners.value.forEach((listener) => listener.remove());
    });

    return {
      products,
      selectedProduct,
      loading,
      error,
      purchasing,
      restoring,
      loadProducts,
      selectProduct,
      purchase,
      restore,
      openTerms,
      openPrivacy,
      closeOutline,
      checkmarkCircle,
      alertCircleOutline,
    };
  },
});
</script>

<style scoped>
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
</style>
