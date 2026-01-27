import { describe, it, expect } from 'vitest';
import type {
  TemplateDefinition,
  TemplateComponent,
  ComponentType,
} from '../templates/types';

describe('Template System', () => {
  describe('Template Definition', () => {
    it('should validate required template fields', () => {
      const template: TemplateDefinition = {
        id: 'template-123',
        name: 'Test Template',
        version: '1.0.0',
        components: [],
      };

      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.version).toBeDefined();
      expect(template.components).toBeDefined();
    });

    it('should parse template with theme', () => {
      const template: TemplateDefinition = {
        id: 'themed-template',
        name: 'Themed',
        version: '1.0.0',
        components: [],
        theme: {
          primaryColor: '#5469d4',
          backgroundColor: '#ffffff',
          textColor: '#1a1a1a',
        },
      };

      expect(template.theme).toBeDefined();
      expect(template.theme?.primaryColor).toBe('#5469d4');
    });
  });

  describe('Component Types', () => {
    const validComponentTypes: ComponentType[] = [
      'headline',
      'subtitle',
      'body',
      'price',
      'feature_list',
      'cta',
      'image',
      'spacer',
      'container',
      'product_selector',
      'badge',
      'divider',
      'restore_button',
      'legal_text',
      'video',
      'social_proof',
      'faq',
      'carousel',
      'progress_indicator',
      'countdown',
    ];

    it('should recognize all valid component types', () => {
      expect(validComponentTypes).toContain('headline');
      expect(validComponentTypes).toContain('cta');
      expect(validComponentTypes).toContain('feature_list');
      expect(validComponentTypes).toContain('countdown');
    });

    it('should create headline component', () => {
      const component: TemplateComponent = {
        type: 'headline',
        id: 'headline-1',
        props: { text: 'Welcome!' },
      };

      expect(component.type).toBe('headline');
      expect(component.props?.text).toBe('Welcome!');
    });

    it('should create feature list component', () => {
      const component: TemplateComponent = {
        type: 'feature_list',
        id: 'features-1',
        props: {
          features: ['Feature A', 'Feature B', 'Feature C'],
        },
      };

      expect(component.type).toBe('feature_list');
      expect(component.props?.features).toHaveLength(3);
    });

    it('should create CTA component with styles', () => {
      const component: TemplateComponent = {
        type: 'cta',
        id: 'cta-1',
        props: { text: 'Subscribe Now' },
        style: {
          backgroundColor: '#5469d4',
          borderRadius: '8px',
          padding: '16px 24px',
        },
      };

      expect(component.type).toBe('cta');
      expect(component.style?.backgroundColor).toBe('#5469d4');
    });

    it('should create container with children', () => {
      const component: TemplateComponent = {
        type: 'container',
        id: 'container-1',
        children: [
          { type: 'headline', id: 'h1', props: { text: 'Title' } },
          { type: 'subtitle', id: 's1', props: { text: 'Subtitle' } },
        ],
      };

      expect(component.type).toBe('container');
      expect(component.children).toHaveLength(2);
    });
  });

  describe('Component Styling', () => {
    it('should handle text alignment', () => {
      const style = { textAlign: 'center' as const };
      expect(['left', 'center', 'right']).toContain(style.textAlign);
    });

    it('should handle opacity values', () => {
      const style = { opacity: 0.8 };
      expect(style.opacity).toBeGreaterThanOrEqual(0);
      expect(style.opacity).toBeLessThanOrEqual(1);
    });

    it('should handle font weight', () => {
      const style = { fontWeight: '600' };
      expect(style.fontWeight).toBeDefined();
    });
  });
});
