/**
 * Template Definition Types for Dynamic Paywall Rendering
 *
 * These types enable over-the-air template updates without requiring
 * app store releases.
 */

/**
 * Complete template definition
 */
export interface TemplateDefinition {
  components: TemplateComponent[];
  theme?: 'light' | 'dark';
  settings?: TemplateSettings;
}

/**
 * Template settings for layout and behavior
 */
export interface TemplateSettings {
  componentSpacing?: number;
  horizontalPadding?: number;
  showCloseButton?: boolean;
  closeButtonDelay?: number;
  backgroundStyle?: BackgroundStyle;
}

/**
 * Background style configuration
 */
export interface BackgroundStyle {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradientColors?: string[];
  imageUrl?: string;
}

/**
 * A single component in the template
 */
export interface TemplateComponent {
  id: string;
  type: ComponentType;
  props: ComponentProps;
  order: number;
  children?: TemplateComponent[];
}

/**
 * Component type enumeration
 */
export type ComponentType =
  | 'headline'
  | 'subtitle'
  | 'text'
  | 'image'
  | 'featureList'
  | 'priceSelector'
  | 'ctaButton'
  | 'restoreButton'
  | 'legal'
  | 'legalLinks'
  | 'spacer'
  | 'container'
  // Phase E additions
  | 'video'
  | 'socialProof'
  | 'faq'
  | 'carousel'
  | 'progressIndicator'
  | 'countdown';

/**
 * Component properties
 */
export interface ComponentProps {
  // Text properties
  text?: string;
  alignment?: 'leading' | 'center' | 'trailing';
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
  fontWeight?: 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;

  // Image properties
  imageUrl?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'wide';

  // Feature list properties
  features?: FeatureItem[];
  showIcons?: boolean;
  iconColor?: string;

  // Button properties
  showPrice?: boolean;
  fullWidth?: boolean;
  backgroundColor?: string;
  cornerRadius?: number;

  // Legal-links properties (v0.5.28 — App Store guideline 3.1.2(c)
  // requires functional Terms + Privacy links on the paywall itself,
  // not just static disclaimer text. Missing them = guaranteed
  // rejection at App Review).
  termsUrl?: string;
  privacyUrl?: string;
  /**
   * Auto-renewal disclosure text — also required by 3.1.2(c) for
   * auto-renewable subscriptions. Defaults to a sensible English string
   * when omitted; customers can override per locale.
   */
  autoRenewText?: string;

  // Spacer properties
  height?: number;

  // Container properties
  padding?: number;

  // Video properties
  videoUrl?: string;
  autoplay?: boolean;
  showControls?: boolean;
  thumbnailUrl?: string;

  // Social proof properties
  averageRating?: number;
  reviewCount?: number;
  downloadCount?: number;

  // FAQ properties
  faqItems?: FAQItem[];

  // Carousel properties
  carouselItems?: CarouselItem[];
  autoRotate?: boolean;
  rotationInterval?: number;

  // Progress indicator properties
  currentStep?: number;
  totalSteps?: number;
  stepLabels?: string[];

  // Countdown properties
  countdownTo?: string; // ISO date string
  countdownStyle?: 'simple' | 'labeled' | 'boxed' | 'circular';
  showDays?: boolean;
}

/**
 * Feature item for feature lists
 */
export interface FeatureItem {
  title: string;
  description?: string;
  icon?: string;
  included?: boolean;
}

/**
 * FAQ item for FAQ components
 */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Carousel item for carousel components
 */
export interface CarouselItem {
  imageUrl?: string;
  title?: string;
  description?: string;
}

/**
 * Result of fetching a template from the API
 */
export interface TemplateLoadResult {
  template: TemplateDefinition | null;
  version: string;
  updatedAt: string;
  cacheTtlSeconds?: number;
  /**
   * v0.5.37 — issue #16. Variants that were merged into the returned
   * template server-side. Empty when the user wasn't identified or no
   * running experiment is scoped to this paywall. Apps can also log
   * these to their own analytics to track which arm rendered.
   */
  appliedVariants?: AppliedVariant[];
}

/**
 * v0.5.37 — issue #16. A single variant merged into a paywall template.
 */
export interface AppliedVariant {
  experimentId: string;
  experimentName: string;
  variantId: string;
  variantName: string;
  isControl: boolean;
}
