// LicenseService 单元测试
import { describe, it, expect, beforeEach } from 'vitest';
import { LicenseService } from './LicenseService';
import { LICENSE_DESCRIPTIONS } from '../../types/license';
import type { LicenseInfo } from '../../types/license';
import type { MembershipTier, LicenseLevel } from '../../types/membership';

describe('LicenseService', () => {
  let service: LicenseService;

  beforeEach(() => {
    service = new LicenseService();
  });

  // ─── getLicenseLevel ────────────────────────────────────

  describe('getLicenseLevel', () => {
    it('Free 用户返回 personal 授权', () => {
      expect(service.getLicenseLevel('free')).toBe('personal');
    });

    it('Pro 用户返回 commercial 授权', () => {
      expect(service.getLicenseLevel('pro')).toBe('commercial');
    });

    it('Business 用户返回 full_commercial 授权', () => {
      expect(service.getLicenseLevel('business')).toBe('full_commercial');
    });
  });

  // ─── embedLicenseMetadata ───────────────────────────────

  describe('embedLicenseMetadata', () => {
    const sampleLicense: LicenseInfo = {
      level: 'commercial',
      tier: 'pro',
      userId: 'user-1',
      generatedAt: new Date('2024-06-15T10:00:00Z'),
      trackId: 'track-abc',
    };

    it('嵌入元数据后 Buffer 大小增加', () => {
      const original = Buffer.from('fake-audio-data');
      const result = service.embedLicenseMetadata(original, sampleLicense);
      expect(result.length).toBeGreaterThan(original.length);
    });

    it('嵌入的元数据包含授权等级', () => {
      const original = Buffer.from('fake-audio-data');
      const result = service.embedLicenseMetadata(original, sampleLicense);
      const content = result.toString('utf-8');
      expect(content).toContain('commercial');
      expect(content).toContain('AI Generated via Lyria 3');
    });

    it('原始数据保持不变', () => {
      const originalData = 'fake-audio-data';
      const original = Buffer.from(originalData);
      const result = service.embedLicenseMetadata(original, sampleLicense);
      expect(result.toString('utf-8').startsWith(originalData)).toBe(true);
    });
  });

  // ─── extractLicenseMetadata (round-trip) ────────────────

  describe('extractLicenseMetadata', () => {
    it('写入后读取的授权信息与原始一致', () => {
      const license: LicenseInfo = {
        level: 'full_commercial',
        tier: 'business',
        userId: 'user-biz',
        generatedAt: new Date('2024-01-01T00:00:00Z'),
        trackId: 'track-xyz',
      };
      const original = Buffer.from('audio-bytes');
      const embedded = service.embedLicenseMetadata(original, license);
      const extracted = service.extractLicenseMetadata(embedded);

      expect(extracted).not.toBeNull();
      expect(extracted!.level).toBe(license.level);
      expect(extracted!.tier).toBe(license.tier);
      expect(extracted!.userId).toBe(license.userId);
      expect(extracted!.trackId).toBe(license.trackId);
      expect(extracted!.generatedAt.toISOString()).toBe(license.generatedAt.toISOString());
    });

    it('无元数据的 Buffer 返回 null', () => {
      const plain = Buffer.from('just-audio-no-metadata');
      expect(service.extractLicenseMetadata(plain)).toBeNull();
    });

    it('personal 授权 round-trip', () => {
      const license: LicenseInfo = {
        level: 'personal',
        tier: 'free',
        userId: 'free-user',
        generatedAt: new Date('2024-12-25T12:00:00Z'),
        trackId: 'track-free',
      };
      const embedded = service.embedLicenseMetadata(Buffer.from('data'), license);
      const extracted = service.extractLicenseMetadata(embedded);
      expect(extracted!.level).toBe('personal');
      expect(extracted!.tier).toBe('free');
    });
  });

  // ─── canCommercialUse ───────────────────────────────────

  describe('canCommercialUse', () => {
    it('Free 用户不可商用', () => {
      expect(service.canCommercialUse('free')).toBe(false);
    });

    it('Pro 用户可商用', () => {
      expect(service.canCommercialUse('pro')).toBe(true);
    });

    it('Business 用户可商用', () => {
      expect(service.canCommercialUse('business')).toBe(true);
    });
  });

  // ─── getLicenseDescription ──────────────────────────────

  describe('getLicenseDescription', () => {
    it('personal 返回中文描述', () => {
      const desc = service.getLicenseDescription('personal');
      expect(desc).toBe('仅限个人非商业使用');
    });

    it('commercial 返回中文描述', () => {
      const desc = service.getLicenseDescription('commercial');
      expect(desc).toContain('个人商业使用');
    });

    it('full_commercial 返回中文描述', () => {
      const desc = service.getLicenseDescription('full_commercial');
      expect(desc).toContain('完整商业授权');
    });

    it('所有授权等级都有描述', () => {
      const levels: LicenseLevel[] = ['personal', 'commercial', 'full_commercial'];
      levels.forEach((level) => {
        expect(service.getLicenseDescription(level)).toBeTruthy();
      });
    });
  });
});
