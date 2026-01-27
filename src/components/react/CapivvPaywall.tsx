import React, { useState, useEffect, useCallback } from 'react';
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
} from '@ionic/react';
import { closeOutline, checkmarkCircle, alertCircleOutline } from 'ionicons/icons';
import { Capivv, Product, Offering, PurchaseResult, ProductType } from '../../index';
import type { PluginListenerHandle } from '@capacitor/core';

export interface CapivvPaywallProps {
  /** The offering ID to display products from */
  offeringId?: string;
  /** Title displayed at the top of the paywall */
  title?: string;
  /** Subtitle displayed below the title */
  subtitle?: string;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether to show the restore purchases button */
  showRestoreButton?: boolean;
  /** List of features to display */
  features?: string[];
  /** Custom text for the purchase button */
  purchaseButtonText?: string;
  /** URL for terms of service */
  termsUrl?: string;
  /** URL for privacy policy */
  privacyUrl?: string;
  /** Enable dark mode styling */
  darkMode?: boolean;
  /** Called when a purchase completes successfully */
  onPurchaseComplete?: (result: PurchaseResult) => void;
  /** Called when a purchase fails */
  onPurchaseFailed?: (error: string) => void;
  /** Called when purchases are restored */
  onRestoreComplete?: () => void;
  /** Called when the paywall is dismissed */
  onDismiss?: () => void;
}

/**
 * Capivv Paywall Component for Ionic React
 *
 * A ready-to-use paywall component that displays available products
 * and handles the purchase flow.
 *
 * @example
 * ```tsx
 * <CapivvPaywall
 *   offeringId="default"
 *   showRestoreButton={true}
 *   onPurchaseComplete={(result) => console.log('Purchased!', result)}
 *   onDismiss={() => setShowPaywall(false)}
 * />
 * ```
 */
export const CapivvPaywall: React.FC<CapivvPaywallProps> = ({
  offeringId = 'default',
  title = 'Unlock Premium',
  subtitle,
  showCloseButton = true,
  showRestoreButton = true,
  features = [],
  purchaseButtonText = 'Subscribe Now',
  termsUrl,
  privacyUrl,
  darkMode = false,
  onPurchaseComplete,
  onPurchaseFailed,
  onRestoreComplete,
  onDismiss,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { offerings } = await Capivv.getOfferings();
      const offering = offerings.find((o: Offering) => o.identifier === offeringId) || offerings[0];

      if (offering) {
        setProducts(offering.products);
        if (offering.products.length > 0) {
          setSelectedProduct(offering.products[0]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const listeners: PluginListenerHandle[] = [];

    const setupListeners = async () => {
      const purchaseListener = await Capivv.addListener('purchaseCompleted', (event) => {
        setPurchasing(false);
        onPurchaseComplete?.({ success: true, transaction: event.transaction });
      });
      listeners.push(purchaseListener);

      const failedListener = await Capivv.addListener('purchaseFailed', (event) => {
        setPurchasing(false);
        onPurchaseFailed?.(event.error);
      });
      listeners.push(failedListener);
    };

    setupListeners();

    return () => {
      listeners.forEach((listener) => listener.remove());
    };
  }, [onPurchaseComplete, onPurchaseFailed]);

  const handlePurchase = async () => {
    if (!selectedProduct) return;

    setPurchasing(true);

    try {
      const result = await Capivv.purchase({
        productIdentifier: selectedProduct.identifier,
        productType: selectedProduct.productType as ProductType,
      });

      if (result.success) {
        onPurchaseComplete?.(result);
      } else {
        onPurchaseFailed?.(result.error || 'Purchase failed');
      }
    } catch (e) {
      onPurchaseFailed?.(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);

    try {
      await Capivv.restorePurchases();
      onRestoreComplete?.();
    } catch (e) {
      onPurchaseFailed?.(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const styles = {
    paywall: {
      '--background': darkMode ? '#1a1a1a' : '#ffffff',
    } as React.CSSProperties,
    container: {
      padding: '16px',
      maxWidth: '500px',
      margin: '0 auto',
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '24px',
    },
    title: {
      fontSize: '24px',
      fontWeight: 700,
      margin: '16px 0 8px',
    },
    subtitle: {
      fontSize: '16px',
      color: 'var(--ion-color-medium)',
      margin: 0,
    },
    loading: {
      textAlign: 'center' as const,
      padding: '48px 16px',
    },
    card: {
      margin: '12px 0',
      position: 'relative' as const,
      border: '2px solid transparent',
      transition: 'border-color 0.2s ease',
    },
    selectedCard: {
      borderColor: 'var(--ion-color-primary)',
    },
    selectedIcon: {
      position: 'absolute' as const,
      top: '12px',
      right: '12px',
      fontSize: '24px',
    },
    productDescription: {
      color: 'var(--ion-color-medium)',
      marginBottom: '12px',
    },
    priceContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    price: {
      fontSize: '20px',
      fontWeight: 700,
      color: 'var(--ion-color-primary)',
    },
    trialBadge: {
      background: 'var(--ion-color-success)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 600,
    },
    features: {
      marginBottom: '24px',
    },
    actions: {
      marginBottom: '24px',
    },
    footer: {
      textAlign: 'center' as const,
    },
    terms: {
      fontSize: '14px',
      color: 'var(--ion-color-medium)',
    },
    link: {
      color: 'var(--ion-color-primary)',
      cursor: 'pointer',
    },
    subscriptionTerms: {
      fontSize: '12px',
      color: 'var(--ion-color-medium)',
      marginTop: '8px',
    },
  };

  return (
    <IonContent style={styles.paywall} className={darkMode ? 'dark' : ''}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          {showCloseButton && (
            <IonButton fill="clear" onClick={onDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          )}
          <h1 style={styles.title}>{title}</h1>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>

        {/* Loading State */}
        {loading && (
          <div style={styles.loading}>
            <IonSpinner />
            <p>Loading products...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={styles.loading}>
            <IonIcon icon={alertCircleOutline} color="danger" style={{ fontSize: '48px' }} />
            <p>{error}</p>
            <IonButton onClick={loadProducts}>Retry</IonButton>
          </div>
        )}

        {/* Products */}
        {!loading && !error && (
          <div style={{ marginBottom: '24px' }}>
            {products.map((product) => (
              <IonCard
                key={product.identifier}
                style={{
                  ...styles.card,
                  ...(selectedProduct?.identifier === product.identifier ? styles.selectedCard : {}),
                }}
                onClick={() => setSelectedProduct(product)}
                button
              >
                <IonCardHeader>
                  <IonCardTitle>{product.title}</IonCardTitle>
                  {product.subscriptionPeriod && (
                    <IonCardSubtitle>{product.subscriptionPeriod}</IonCardSubtitle>
                  )}
                </IonCardHeader>
                <IonCardContent>
                  <p style={styles.productDescription}>{product.description}</p>
                  <div style={styles.priceContainer}>
                    <span style={styles.price}>{product.priceString}</span>
                    {product.trialPeriod && (
                      <span style={styles.trialBadge}>{product.trialPeriod} free trial</span>
                    )}
                  </div>
                </IonCardContent>
                {selectedProduct?.identifier === product.identifier && (
                  <IonIcon
                    icon={checkmarkCircle}
                    color="primary"
                    style={styles.selectedIcon}
                  />
                )}
              </IonCard>
            ))}
          </div>
        )}

        {/* Features List */}
        {features.length > 0 && (
          <div style={styles.features}>
            <h3>What you'll get:</h3>
            <IonList lines="none">
              {features.map((feature, index) => (
                <IonItem key={index}>
                  <IonIcon icon={checkmarkCircle} color="success" slot="start" />
                  <IonLabel>{feature}</IonLabel>
                </IonItem>
              ))}
            </IonList>
          </div>
        )}

        {/* Purchase Button */}
        <div style={styles.actions}>
          <IonButton
            expand="block"
            size="large"
            disabled={!selectedProduct || purchasing}
            onClick={handlePurchase}
          >
            {purchasing ? <IonSpinner /> : purchaseButtonText}
          </IonButton>

          {showRestoreButton && (
            <IonButton
              expand="block"
              fill="clear"
              onClick={handleRestore}
              disabled={restoring}
              style={{ marginTop: '8px' }}
            >
              {restoring ? <IonSpinner name="dots" /> : 'Restore Purchases'}
            </IonButton>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.terms}>
            {termsUrl && (
              <span style={styles.link} onClick={() => window.open(termsUrl, '_blank')}>
                Terms of Service
              </span>
            )}
            {termsUrl && privacyUrl && ' • '}
            {privacyUrl && (
              <span style={styles.link} onClick={() => window.open(privacyUrl, '_blank')}>
                Privacy Policy
              </span>
            )}
          </p>
          {selectedProduct?.productType === 'SUBSCRIPTION' && (
            <p style={styles.subscriptionTerms}>
              Subscription automatically renews unless cancelled at least 24 hours before the end of
              the current period.
            </p>
          )}
        </div>
      </div>
    </IonContent>
  );
};

export default CapivvPaywall;
