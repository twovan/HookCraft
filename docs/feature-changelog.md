# HookCraft 功能上线与变更记录

> 后续有新功能上线、已有功能修改、后台配置能力调整、生产部署说明，都统一记录在这个文件中。设计方案、实施计划和临时讨论文档不作为最终功能记录入口。

## 2026-05-26 后台会员套餐名称与价格配置

### 功能状态

已上线到生产环境。

生产地址：

```text
https://hookcraft.io
```

### 功能说明

后台会员定价页面支持维护套餐展示名称、月付价格和年付价格。保存后，前台 `/pricing` 的套餐卡片会读取后台配置并同步展示。

后台入口：

```text
/admin/credits/pricing
```

前台展示页：

```text
/pricing
```

### 可配置项

| 套餐标识 | 默认名称 | 后台可配置项 |
| --- | --- | --- |
| `free` | 免费版 | 套餐名称、月付价格、年付价格 |
| `pro` | 专业版 | 套餐名称、月付价格、年付价格 |
| `business` | 商业版 | 套餐名称、月付价格、年付价格 |

价格输入单位为“分”。

| 展示价格 | 后台输入值 |
| --- | --- |
| `¥199/月` | `19900` |
| `¥499/月` | `49900` |
| `¥1910.4/年` | `191040` |

### 数据结构

配置复用现有 `admin_config.pricing`。每条配置结构如下：

```json
{
  "tier": "pro",
  "name": "专业版",
  "monthlyPrice": 19900,
  "yearlyPrice": 191040
}
```

兼容规则：

- 历史配置没有 `name` 字段时，继续使用 `src/config/tierConfig.ts` 中的默认套餐名称。
- 后台 `name` 为空字符串时，前台回退到默认套餐名称。
- 前台 `/pricing` 合并默认套餐配置、`admin_config.pricing` 和 `admin_config.credit_quota`，后台配置优先级更高。

### 涉及文件

- `src/app/admin/credits/pricing/page.tsx`
- `src/app/api/admin/config/pricing/route.ts`
- `src/lib/pricing/publicPricingConfig.ts`
- `src/lib/pricing/publicPricingConfig.test.ts`
- `src/types/admin.ts`

### 验证记录

已执行：

```bash
npm test -- src/lib/pricing/publicPricingConfig.test.ts
npm run typecheck
npm run build
npx vercel deploy --prod --yes
```

用户已在生产环境完成了功能测试。
