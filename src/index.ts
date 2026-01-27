import { registerPlugin } from '@capacitor/core';

import type { CapivvPlugin } from './definitions';

const Capivv = registerPlugin<CapivvPlugin>('Capivv', {
  web: () => import('./web').then((m) => new m.CapivvWeb()),
});

// Core exports
export * from './definitions';
export { Capivv };

// Template types
export type {
  TemplateDefinition,
  TemplateSettings,
  TemplateComponent,
  ComponentType,
  ComponentProps,
  BackgroundStyle,
  FeatureItem,
  FAQItem,
  CarouselItem,
  TemplateLoadResult,
} from './templates/types';

// Localization
export { l10n, CapivvL10n } from './l10n/translations';
export type { SupportedLocale, CapivvStrings } from './l10n/translations';
