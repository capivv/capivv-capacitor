import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonAccordionGroup,
  IonAccordion,
} from '@ionic/react';
import {
  closeOutline,
  checkmarkCircle,
  closeCircle,
  alertCircleOutline,
  star,
  chatbubbles,
  download,
  playCircle,
} from 'ionicons/icons';
import { Capivv, Product, PurchaseResult, ProductType } from '../../index';
import type { PluginListenerHandle } from '@capacitor/core';
import type {
  TemplateDefinition,
  TemplateComponent,
  ComponentProps,
  FAQItem,
  CarouselItem,
} from '../../templates/types';
import { l10n } from '../../l10n/translations';

export interface DynamicPaywallProps {
  /** The template definition to render */
  template: TemplateDefinition;
  /** The offering ID to display products from */
  offeringId?: string;
  /** Pre-loaded products (optional) */
  products?: Product[];
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Custom primary color */
  primaryColor?: string;
  /** Custom background color */
  backgroundColor?: string;
  /** Custom text color */
  textColor?: string;
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
 * Dynamic Paywall Component for Ionic React
 *
 * A paywall that renders from a template definition,
 * enabling over-the-air template updates.
 */
export const DynamicPaywall: React.FC<DynamicPaywallProps> = ({
  template,
  offeringId = 'default',
  products: initialProducts,
  showCloseButton = true,
  primaryColor,
  backgroundColor,
  textColor,
  onPurchaseComplete,
  onPurchaseFailed,
  onRestoreComplete,
  onDismiss,
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    initialProducts?.[0] || null
  );
  const [loading, setLoading] = useState(!initialProducts);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Determine theme colors
  const isDark = template.theme === 'dark';
  const colors = useMemo(
    () => ({
      primary: primaryColor || 'var(--ion-color-primary)',
      background: backgroundColor || (isDark ? '#1C1C1E' : '#ffffff'),
      text: textColor || (isDark ? '#ffffff' : '#000000'),
    }),
    [primaryColor, backgroundColor, textColor, isDark]
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { offerings } = await Capivv.getOfferings();
      const offering =
        offerings.find((o) => o.identifier === offeringId) || offerings[0];

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
    if (!initialProducts) {
      loadProducts();
    }
  }, [loadProducts, initialProducts]);

  useEffect(() => {
    const listeners: PluginListenerHandle[] = [];

    const setupListeners = async () => {
      const purchaseListener = await Capivv.addListener(
        'purchaseCompleted',
        (event) => {
          setPurchasing(false);
          onPurchaseComplete?.({ success: true, transaction: event.transaction });
        }
      );
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

  // Render a single component
  const renderComponent = (component: TemplateComponent): React.ReactNode => {
    const { type, props } = component;

    switch (type) {
      case 'headline':
        return renderHeadline(props);
      case 'subtitle':
        return renderSubtitle(props);
      case 'text':
        return renderText(props);
      case 'image':
        return renderImage(props);
      case 'featureList':
        return renderFeatureList(props);
      case 'priceSelector':
        return renderPriceSelector();
      case 'ctaButton':
        return renderCtaButton(props);
      case 'restoreButton':
        return renderRestoreButton(props);
      case 'legal':
        return renderLegal();
      case 'spacer':
        return renderSpacer(props);
      case 'video':
        return renderVideo(props);
      case 'socialProof':
        return renderSocialProof(props);
      case 'faq':
        return renderFaq(props);
      case 'carousel':
        return renderCarousel(props);
      case 'progressIndicator':
        return renderProgressIndicator(props);
      case 'countdown':
        return renderCountdown(props);
      default:
        return null;
    }
  };

  const renderHeadline = (props: ComponentProps) => (
    <h1
      style={{
        fontSize: getFontSize(props.fontSize || 'xlarge'),
        fontWeight: getFontWeight(props.fontWeight || 'bold'),
        color: props.color || colors.text,
        textAlign: getTextAlign(props.alignment),
        margin: '0 0 8px 0',
      }}
    >
      {props.text}
    </h1>
  );

  const renderSubtitle = (props: ComponentProps) => (
    <p
      style={{
        fontSize: getFontSize(props.fontSize || 'medium'),
        fontWeight: getFontWeight(props.fontWeight || 'regular'),
        color: props.color || `${colors.text}B3`,
        textAlign: getTextAlign(props.alignment),
        margin: '0 0 8px 0',
      }}
    >
      {props.text}
    </p>
  );

  const renderText = (props: ComponentProps) => (
    <p
      style={{
        fontSize: getFontSize(props.fontSize || 'medium'),
        fontWeight: getFontWeight(props.fontWeight || 'regular'),
        color: props.color || colors.text,
        textAlign: getTextAlign(props.alignment),
        margin: '0 0 8px 0',
      }}
    >
      {props.text}
    </p>
  );

  const renderImage = (props: ComponentProps) => {
    if (!props.imageUrl) return null;
    return (
      <img
        src={props.imageUrl}
        alt=""
        style={{
          width: '100%',
          borderRadius: props.cornerRadius || 12,
          aspectRatio: getAspectRatio(props.aspectRatio),
          objectFit: 'cover',
        }}
      />
    );
  };

  const renderFeatureList = (props: ComponentProps) => {
    const features = props.features || [];
    const showIcons = props.showIcons !== false;

    return (
      <IonList lines="none" style={{ background: 'transparent' }}>
        {features.map((feature, index) => (
          <IonItem key={index} style={{ '--background': 'transparent' }}>
            {showIcons && (
              <IonIcon
                icon={feature.included !== false ? checkmarkCircle : closeCircle}
                color={feature.included !== false ? 'success' : 'medium'}
                slot="start"
              />
            )}
            <IonLabel>
              <h3 style={{ color: colors.text }}>{feature.title}</h3>
              {feature.description && (
                <p style={{ color: `${colors.text}99` }}>{feature.description}</p>
              )}
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
    );
  };

  const renderPriceSelector = () => {
    if (products.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        {products.map((product) => {
          const isSelected = selectedProduct?.identifier === product.identifier;
          return (
            <IonCard
              key={product.identifier}
              button
              onClick={() => setSelectedProduct(product)}
              style={{
                margin: '12px 0',
                border: isSelected ? `2px solid ${colors.primary}` : '2px solid transparent',
                '--background': isSelected ? `${colors.primary}1A` : undefined,
              }}
            >
              <IonCardHeader>
                <IonCardTitle style={{ color: colors.text }}>
                  {product.title}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: `${colors.text}99` }}>{product.description}</span>
                  <span style={{ fontWeight: 'bold', color: colors.primary, fontSize: 18 }}>
                    {product.priceString}
                  </span>
                </div>
              </IonCardContent>
            </IonCard>
          );
        })}
      </div>
    );
  };

  const renderCtaButton = (props: ComponentProps) => {
    let buttonText = props.text || l10n.get('common.continue');
    if (props.showPrice && selectedProduct) {
      buttonText = `${buttonText} - ${selectedProduct.priceString}`;
    }

    return (
      <IonButton
        expand="block"
        size="large"
        disabled={!selectedProduct || purchasing}
        onClick={handlePurchase}
        style={{
          '--background': props.backgroundColor || colors.primary,
          '--border-radius': `${props.cornerRadius || 12}px`,
        }}
      >
        {purchasing ? <IonSpinner /> : buttonText}
      </IonButton>
    );
  };

  const renderRestoreButton = (props: ComponentProps) => (
    <IonButton
      expand="block"
      fill="clear"
      onClick={handleRestore}
      disabled={restoring}
      style={{ marginTop: 8 }}
    >
      {restoring ? <IonSpinner name="dots" /> : props.text || l10n.get('paywall.restore')}
    </IonButton>
  );

  const renderLegal = () => (
    <p
      style={{
        fontSize: 12,
        color: `${colors.text}80`,
        textAlign: 'center',
        marginTop: 16,
      }}
    >
      {l10n.get('paywall.legalDisclaimer')}
    </p>
  );

  const renderSpacer = (props: ComponentProps) => (
    <div style={{ height: props.height || 16 }} />
  );

  const renderVideo = (props: ComponentProps) => {
    const thumbnailUrl = props.thumbnailUrl || props.imageUrl;

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: props.cornerRadius || 12,
          overflow: 'hidden',
          backgroundColor: '#333',
        }}
      >
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <IonIcon
            icon={playCircle}
            style={{ fontSize: 64, color: 'rgba(255, 255, 255, 0.9)' }}
          />
        </div>
      </div>
    );
  };

  const renderSocialProof = (props: ComponentProps) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-evenly',
        padding: '16px 0',
      }}
    >
      {props.averageRating !== undefined && (
        <div style={{ textAlign: 'center' }}>
          <IonIcon icon={star} style={{ fontSize: 28, color: colors.primary }} />
          <div style={{ fontWeight: 'bold', fontSize: 18, color: colors.text }}>
            {props.averageRating.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: `${colors.text}99` }}>
            {l10n.get('socialProof.rating')}
          </div>
        </div>
      )}
      {props.reviewCount !== undefined && (
        <div style={{ textAlign: 'center' }}>
          <IonIcon icon={chatbubbles} style={{ fontSize: 28, color: colors.primary }} />
          <div style={{ fontWeight: 'bold', fontSize: 18, color: colors.text }}>
            {formatNumber(props.reviewCount)}
          </div>
          <div style={{ fontSize: 12, color: `${colors.text}99` }}>
            {l10n.get('socialProof.reviews')}
          </div>
        </div>
      )}
      {props.downloadCount !== undefined && (
        <div style={{ textAlign: 'center' }}>
          <IonIcon icon={download} style={{ fontSize: 28, color: colors.primary }} />
          <div style={{ fontWeight: 'bold', fontSize: 18, color: colors.text }}>
            {formatNumber(props.downloadCount)}
          </div>
          <div style={{ fontSize: 12, color: `${colors.text}99` }}>
            {l10n.get('socialProof.downloads')}
          </div>
        </div>
      )}
    </div>
  );

  const renderFaq = (props: ComponentProps) => {
    const items = props.faqItems || [];

    return (
      <IonAccordionGroup>
        {items.map((item: FAQItem, index: number) => (
          <IonAccordion key={index} value={`faq-${index}`}>
            <IonItem slot="header" color="light">
              <IonLabel style={{ fontWeight: 600 }}>{item.question}</IonLabel>
            </IonItem>
            <div className="ion-padding" slot="content">
              {item.answer}
            </div>
          </IonAccordion>
        ))}
      </IonAccordionGroup>
    );
  };

  const renderCarousel = (props: ComponentProps) => {
    const items = props.carouselItems || [];
    if (items.length === 0) return null;

    // Auto-rotate effect
    useEffect(() => {
      if (props.autoRotate) {
        const interval = setInterval(() => {
          setCarouselIndex((prev) => (prev + 1) % items.length);
        }, (props.rotationInterval || 3) * 1000);
        return () => clearInterval(interval);
      }
    }, [props.autoRotate, props.rotationInterval, items.length]);

    const currentItem = items[carouselIndex];

    return (
      <div style={{ textAlign: 'center' }}>
        {currentItem.imageUrl && (
          <img
            src={currentItem.imageUrl}
            alt=""
            style={{
              width: '100%',
              maxHeight: 200,
              objectFit: 'cover',
              borderRadius: 12,
            }}
          />
        )}
        {currentItem.title && (
          <h4 style={{ color: colors.text, margin: '8px 0 4px' }}>
            {currentItem.title}
          </h4>
        )}
        {currentItem.description && (
          <p style={{ color: `${colors.text}99`, margin: 0 }}>
            {currentItem.description}
          </p>
        )}
        <div style={{ marginTop: 8 }}>
          {items.map((_, index) => (
            <span
              key={index}
              onClick={() => setCarouselIndex(index)}
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                margin: '0 4px',
                background: index === carouselIndex ? colors.primary : `${colors.text}40`,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderProgressIndicator = (props: ComponentProps) => {
    const currentStep = props.currentStep || 1;
    const totalSteps = props.totalSteps || 3;
    const labels = props.stepLabels || [];

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {Array.from({ length: totalSteps }).map((_, index) => {
            const isCompleted = index < currentStep - 1;
            const isCurrent = index === currentStep - 1;
            return (
              <React.Fragment key={index}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isCompleted || isCurrent ? colors.primary : `${colors.text}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isCompleted || isCurrent ? '#fff' : colors.text,
                    fontSize: 12,
                    fontWeight: 'bold',
                  }}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                {index < totalSteps - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: isCompleted ? colors.primary : `${colors.text}33`,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {labels.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {labels.slice(0, totalSteps).map((label, index) => (
              <span
                key={index}
                style={{
                  fontSize: 10,
                  color: `${colors.text}99`,
                  textAlign: 'center',
                  flex: 1,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCountdown = (props: ComponentProps) => {
    const [remaining, setRemaining] = useState<Duration>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
      if (!props.countdownTo) return;

      const updateRemaining = () => {
        const target = new Date(props.countdownTo!);
        const now = new Date();
        const diff = Math.max(0, target.getTime() - now.getTime());

        setRemaining({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      };

      updateRemaining();
      const interval = setInterval(updateRemaining, 1000);
      return () => clearInterval(interval);
    }, [props.countdownTo]);

    const style = props.countdownStyle || 'simple';
    const showDays = props.showDays !== false;

    if (style === 'simple') {
      return (
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: colors.text }}>
          {showDays && `${remaining.days}${l10n.get('countdown.days')} `}
          {remaining.hours}${l10n.get('countdown.hours')} {remaining.minutes}${l10n.get('countdown.minutes')} {remaining.seconds}${l10n.get('countdown.seconds')}
        </div>
      );
    }

    const units = [
      ...(showDays ? [{ value: remaining.days, label: l10n.get('countdown.days') }] : []),
      { value: remaining.hours, label: l10n.get('countdown.hours') },
      { value: remaining.minutes, label: l10n.get('countdown.minutes') },
      { value: remaining.seconds, label: l10n.get('countdown.seconds') },
    ];

    if (style === 'boxed') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {units.map((unit, index) => (
            <div
              key={index}
              style={{
                width: 50,
                padding: '8px 0',
                background: `${colors.primary}1A`,
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 'bold', color: colors.primary }}>
                {String(unit.value).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 10, color: `${colors.text}99` }}>{unit.label}</div>
            </div>
          ))}
        </div>
      );
    }

    // labeled style
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        {units.map((unit, index) => (
          <div key={index} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
              {String(unit.value).padStart(2, '0')}
            </div>
            <div style={{ fontSize: 12, color: `${colors.text}99` }}>{unit.label}</div>
          </div>
        ))}
      </div>
    );
  };

  // Sort components by order
  const sortedComponents = useMemo(
    () => [...template.components].sort((a, b) => a.order - b.order),
    [template.components]
  );

  const settings = template.settings || {};
  const spacing = settings.componentSpacing || 16;
  const padding = settings.horizontalPadding || 16;

  const styles = {
    content: {
      '--background': colors.background,
    } as React.CSSProperties,
    container: {
      padding,
    },
  };

  return (
    <IonContent style={styles.content}>
      <div style={styles.container}>
        {/* Close button */}
        {(showCloseButton || settings.showCloseButton) && (
          <div style={{ textAlign: 'right' }}>
            <IonButton fill="clear" onClick={onDismiss}>
              <IonIcon icon={closeOutline} style={{ color: `${colors.text}80` }} />
            </IonButton>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <IonSpinner />
            <p style={{ color: colors.text }}>{l10n.get('common.loading')}</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <IonIcon
              icon={alertCircleOutline}
              color="danger"
              style={{ fontSize: 48 }}
            />
            <p style={{ color: colors.text }}>{l10n.get('error.failedToLoadOfferings')}</p>
            <p style={{ color: `${colors.text}99` }}>{error}</p>
            <IonButton onClick={loadProducts}>{l10n.get('common.tryAgain')}</IonButton>
          </div>
        )}

        {/* Components */}
        {!loading && !error && (
          <>
            {sortedComponents.map((component, index) => (
              <div key={component.id || index} style={{ marginBottom: spacing }}>
                {renderComponent(component)}
              </div>
            ))}
          </>
        )}

        {/* Loading overlay */}
        {(purchasing || restoring) && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                padding: 24,
                borderRadius: 16,
                textAlign: 'center',
              }}
            >
              <IonSpinner color="light" />
              <p style={{ color: '#fff', marginTop: 12 }}>
                {restoring ? l10n.get('paywall.restoring') : l10n.get('common.processing')}
              </p>
            </div>
          </div>
        )}
      </div>
    </IonContent>
  );
};

// Helper types
interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Helper functions
function getFontSize(size: string): number {
  const sizes: Record<string, number> = {
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
    xxlarge: 32,
  };
  return sizes[size] || 16;
}

function getFontWeight(weight: string): number {
  const weights: Record<string, number> = {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };
  return weights[weight] || 400;
}

function getTextAlign(alignment?: string): 'left' | 'center' | 'right' {
  const aligns: Record<string, 'left' | 'center' | 'right'> = {
    leading: 'left',
    center: 'center',
    trailing: 'right',
  };
  return aligns[alignment || 'leading'] || 'left';
}

function getAspectRatio(ratio?: string): string {
  const ratios: Record<string, string> = {
    square: '1/1',
    landscape: '16/9',
    portrait: '3/4',
    wide: '21/9',
  };
  return ratios[ratio || 'landscape'] || '16/9';
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export default DynamicPaywall;
