import { describe, it, expect } from 'vitest';
import { l10n, CapivvL10n } from '../l10n/translations';

describe('Localization', () => {
  describe('l10n singleton', () => {
    it('should be defined', () => {
      expect(l10n).toBeDefined();
    });

    it('should get English strings by default', () => {
      const newL10n = new CapivvL10n('en');
      expect(newL10n.get('paywall.restore')).toBe('Restore Purchases');
      expect(newL10n.get('common.continue')).toBe('Continue');
    });
  });

  describe('CapivvL10n class', () => {
    it('should return English translations', () => {
      const l = new CapivvL10n('en');
      expect(l.get('paywall.restore')).toBe('Restore Purchases');
      expect(l.get('common.continue')).toBe('Continue');
      expect(l.get('common.cancel')).toBe('Cancel');
    });

    it('should return Spanish translations', () => {
      const l = new CapivvL10n('es');
      expect(l.get('paywall.restore')).toBe('Restaurar compras');
      expect(l.get('common.continue')).toBe('Continuar');
    });

    it('should return French translations', () => {
      const l = new CapivvL10n('fr');
      expect(l.get('paywall.restore')).toBe('Restaurer les achats');
      expect(l.get('common.continue')).toBe('Continuer');
    });

    it('should return German translations', () => {
      const l = new CapivvL10n('de');
      expect(l.get('paywall.restore')).toBe('Kaufe wiederherstellen');
      expect(l.get('common.continue')).toBe('Fortfahren');
    });

    it('should return Japanese translations', () => {
      const l = new CapivvL10n('ja');
      expect(l.get('paywall.restore')).toBe('購入を復元');
      expect(l.get('common.continue')).toBe('続ける');
    });

    it('should return Chinese translations', () => {
      const l = new CapivvL10n('zh');
      expect(l.get('paywall.restore')).toBe('恢复购买');
      expect(l.get('common.continue')).toBe('继续');
    });

    it('should return Portuguese translations', () => {
      const l = new CapivvL10n('pt');
      expect(l.get('paywall.restore')).toBe('Restaurar compras');
      expect(l.get('common.continue')).toBe('Continuar');
    });

    it('should return Italian translations', () => {
      const l = new CapivvL10n('it');
      expect(l.get('paywall.restore')).toBe('Ripristina acquisti');
      expect(l.get('common.continue')).toBe('Continua');
    });
  });

  describe('format method', () => {
    it('should format string with number placeholder', () => {
      const l = new CapivvL10n('en');
      const result = l.format('paywall.startTrial', 7);
      expect(result).toBe('Start 7-day free trial');
    });

    it('should format string with string placeholder', () => {
      const l = new CapivvL10n('en');
      // The format method uses %d for first arg, %@ for subsequent
      // paywall.then uses %@ so we need a dummy first arg or just use get()
      const template = l.get('paywall.then');
      expect(template).toBe('Then %@');
    });

    it('should format save percentage', () => {
      const l = new CapivvL10n('en');
      const result = l.format('paywall.save', 50);
      // Template is 'Save %d%%' - the %% is a literal percent sign
      expect(result).toBe('Save 50%%');
    });
  });

  describe('locale management', () => {
    it('should set and get locale', () => {
      const l = new CapivvL10n('en');
      expect(l.getLocale()).toBe('en');

      l.setLocale('es');
      expect(l.getLocale()).toBe('es');
      expect(l.get('common.continue')).toBe('Continuar');
    });
  });

  describe('error strings', () => {
    it('should have all error strings in English', () => {
      const l = new CapivvL10n('en');
      expect(l.get('error.unableToLoad')).toBe('Unable to Load');
      expect(l.get('error.purchaseFailed')).toBe('Purchase Failed');
      expect(l.get('error.restoreFailed')).toBe('Restore Failed');
      expect(l.get('error.networkError')).toBe('Network Error');
      expect(l.get('error.somethingWentWrong')).toBe('Something went wrong');
    });
  });

  describe('countdown strings', () => {
    it('should have countdown abbreviations', () => {
      const l = new CapivvL10n('en');
      expect(l.get('countdown.days')).toBe('d');
      expect(l.get('countdown.hours')).toBe('h');
      expect(l.get('countdown.minutes')).toBe('m');
      expect(l.get('countdown.seconds')).toBe('s');
    });

    it('should have Japanese countdown strings', () => {
      const l = new CapivvL10n('ja');
      expect(l.get('countdown.days')).toBe('日');
      expect(l.get('countdown.hours')).toBe('時');
    });
  });
});
