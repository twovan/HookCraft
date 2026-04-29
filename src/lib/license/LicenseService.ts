// lib/license/LicenseService.ts - 商用授权管理服务

import type { MembershipTier, LicenseLevel } from '../../types/membership';
import type { LicenseInfo } from '../../types/license';
import { LICENSE_DESCRIPTIONS } from '../../types/license';
import { TIER_CONFIGS } from '../../config/tierConfig';

/** 嵌入元数据的标记前缀 */
const LICENSE_METADATA_PREFIX = 'HOOKCRAFT_LICENSE::';
const LICENSE_METADATA_SUFFIX = '::END_LICENSE';

/**
 * LicenseService - 商用授权管理服务
 *
 * 负责授权等级查询、导出文件元数据嵌入、商用权限判断和授权描述。
 * Free=personal（禁止商用）、Pro=commercial（个人商用）、Business=full_commercial（完整商用）
 */
export class LicenseService {
  /**
   * 获取用户等级对应的授权等级
   *
   * Free → personal（禁止商用）
   * Pro → commercial（个人商用）
   * Business → full_commercial（完整商用）
   *
   * @param userTier - 用户会员等级
   * @returns LicenseLevel 授权等级
   */
  getLicenseLevel(userTier: MembershipTier): LicenseLevel {
    return TIER_CONFIGS[userTier].licenseLevel;
  }

  /**
   * 在导出文件元数据中嵌入授权信息
   *
   * 将授权等级、用户 ID、生成时间、音轨 ID 等信息
   * 序列化后写入文件 Buffer 末尾（模拟元数据嵌入）。
   *
   * @param fileBuffer - 原始文件 Buffer
   * @param license - 授权信息
   * @returns 嵌入元数据后的 Buffer
   */
  embedLicenseMetadata(fileBuffer: Buffer, license: LicenseInfo): Buffer {
    const metadata = {
      level: license.level,
      tier: license.tier,
      userId: license.userId,
      generatedAt: license.generatedAt.toISOString(),
      trackId: license.trackId,
      watermark: 'AI Generated via Lyria 3',
    };

    const metadataStr = `${LICENSE_METADATA_PREFIX}${JSON.stringify(metadata)}${LICENSE_METADATA_SUFFIX}`;
    const metadataBuffer = Buffer.from(metadataStr, 'utf-8');

    return Buffer.concat([fileBuffer, metadataBuffer]);
  }

  /**
   * 从文件 Buffer 中读取嵌入的授权元数据
   *
   * @param fileBuffer - 含元数据的文件 Buffer
   * @returns 解析出的授权信息，若无元数据则返回 null
   */
  extractLicenseMetadata(fileBuffer: Buffer): LicenseInfo | null {
    const content = fileBuffer.toString('utf-8');
    const prefixIdx = content.lastIndexOf(LICENSE_METADATA_PREFIX);
    const suffixIdx = content.lastIndexOf(LICENSE_METADATA_SUFFIX);

    if (prefixIdx === -1 || suffixIdx === -1 || suffixIdx <= prefixIdx) {
      return null;
    }

    const jsonStr = content.slice(
      prefixIdx + LICENSE_METADATA_PREFIX.length,
      suffixIdx
    );

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        level: parsed.level,
        tier: parsed.tier,
        userId: parsed.userId,
        generatedAt: new Date(parsed.generatedAt),
        trackId: parsed.trackId,
      };
    } catch {
      return null;
    }
  }

  /**
   * 判断用户是否可以商用
   *
   * Pro 和 Business 用户可商用，Free 用户不可。
   *
   * @param userTier - 用户会员等级
   * @returns true 表示可商用
   */
  canCommercialUse(userTier: MembershipTier): boolean {
    return userTier === 'pro' || userTier === 'business';
  }

  /**
   * 获取授权等级的中文描述
   *
   * @param level - 授权等级
   * @returns 中文描述字符串
   */
  getLicenseDescription(level: LicenseLevel): string {
    return LICENSE_DESCRIPTIONS[level];
  }
}
