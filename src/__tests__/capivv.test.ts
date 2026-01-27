import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Capacitor core
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({
    configure: vi.fn().mockResolvedValue(undefined),
    identify: vi.fn().mockResolvedValue({ userId: 'user-123' }),
    checkEntitlement: vi.fn().mockResolvedValue({ hasAccess: true }),
    getEntitlements: vi.fn().mockResolvedValue({ entitlements: [] }),
    getOfferings: vi.fn().mockResolvedValue({ offerings: [] }),
    purchase: vi.fn().mockResolvedValue({ success: true }),
    restorePurchases: vi.fn().mockResolvedValue({ entitlements: [] }),
    syncPurchases: vi.fn().mockResolvedValue({ entitlements: [] }),
  })),
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

describe('Capivv SDK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('module exports', () => {
    it('should export Capivv plugin', async () => {
      const { Capivv } = await import('../index');
      expect(Capivv).toBeDefined();
    });

    it('should export l10n', async () => {
      const { l10n } = await import('../index');
      expect(l10n).toBeDefined();
    });

    it('should export CapivvL10n class', async () => {
      const { CapivvL10n } = await import('../index');
      expect(CapivvL10n).toBeDefined();
    });
  });

  describe('Capivv plugin methods', () => {
    it('should have configure method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.configure).toBe('function');
    });

    it('should have identify method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.identify).toBe('function');
    });

    it('should have checkEntitlement method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.checkEntitlement).toBe('function');
    });

    it('should have getEntitlements method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.getEntitlements).toBe('function');
    });

    it('should have getOfferings method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.getOfferings).toBe('function');
    });

    it('should have purchase method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.purchase).toBe('function');
    });

    it('should have restorePurchases method', async () => {
      const { Capivv } = await import('../index');
      expect(typeof Capivv.restorePurchases).toBe('function');
    });
  });

  describe('configure', () => {
    it('should have configure as a function', async () => {
      const { Capivv } = await import('../index');
      expect(Capivv.configure).toBeDefined();
      expect(typeof Capivv.configure).toBe('function');
    });
  });

  describe('identify', () => {
    it('should have identify as a function', async () => {
      const { Capivv } = await import('../index');
      expect(Capivv.identify).toBeDefined();
      expect(typeof Capivv.identify).toBe('function');
    });
  });

  describe('checkEntitlement', () => {
    it('should have checkEntitlement as a function', async () => {
      const { Capivv } = await import('../index');
      expect(Capivv.checkEntitlement).toBeDefined();
      expect(typeof Capivv.checkEntitlement).toBe('function');
    });
  });

  describe('getEntitlements', () => {
    it('should have getEntitlements as a function', async () => {
      const { Capivv } = await import('../index');
      expect(Capivv.getEntitlements).toBeDefined();
      expect(typeof Capivv.getEntitlements).toBe('function');
    });
  });
});
