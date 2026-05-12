# Bugfix Requirements Document

## Introduction

模板的 `analysis_status` 字段在关键时机没有自动触发音频分析。当管理员通过后台上传新的模板音频，或者用户提交的模板审核通过（状态从 `pending` 变为 `published`）时，系统应该自动触发 Gemini 音频分析流程，但当前实现中这两个操作都没有触发分析，导致 `analysis_status` 一直停留在 `pending` 状态。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 管理员通过 `POST /api/admin/templates/[id]/audio` 上传新的模板音频 THEN the system 仅更新 `preview_url` 字段，不更新 `analysis_status`，也不触发音频分析流程

1.2 WHEN 管理员通过 `PATCH /api/admin/templates/[id]` 将模板状态从 `pending` 变更为 `published`（审核通过） THEN the system 仅更新 `status` 字段，不触发音频分析流程

1.3 WHEN 上述两种场景发生后 THEN the system 的 `analysis_status` 保持为 `pending`，模板没有可用的分析结果（`analysis_result` 和 `lyria_prompt` 为空）

### Expected Behavior (Correct)

2.1 WHEN 管理员通过 `POST /api/admin/templates/[id]/audio` 上传新的模板音频 THEN the system SHALL 将 `analysis_status` 更新为 `analyzing` 并异步触发 Gemini 音频分析流程（使用刚上传的音频）

2.2 WHEN 管理员通过 `PATCH /api/admin/templates/[id]` 将模板状态从 `pending` 变更为 `published`（审核通过）且该模板已有音频（`preview_url` 非空）且 `analysis_status` 为 `pending` 或 `failed` THEN the system SHALL 将 `analysis_status` 更新为 `analyzing` 并异步触发 Gemini 音频分析流程

2.3 WHEN 自动触发的分析成功完成 THEN the system SHALL 将 `analysis_status` 更新为 `completed`，并保存 `analysis_result` 和 `lyria_prompt`

2.4 WHEN 自动触发的分析失败 THEN the system SHALL 将 `analysis_status` 更新为 `failed`，不影响模板的其他字段（管理员可后续手动填写或重试）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 管理员通过 `POST /api/admin/templates/analyze` 手动触发分析 THEN the system SHALL CONTINUE TO 正常执行分析流程并返回结果

3.2 WHEN 管理员通过 `PUT /api/admin/templates/[id]/analysis` 手动填写分析结果 THEN the system SHALL CONTINUE TO 正常保存手动填写的分析结果

3.3 WHEN 模板状态变更为非 `published` 的其他状态（如 `unpublished`、`rejected`） THEN the system SHALL CONTINUE TO 仅更新状态字段，不触发分析

3.4 WHEN 模板状态变更为 `published` 但 `analysis_status` 已经是 `completed` THEN the system SHALL CONTINUE TO 不重复触发分析（保留已有分析结果）

3.5 WHEN 模板状态变更为 `published` 但模板没有音频（`preview_url` 为空） THEN the system SHALL CONTINUE TO 不触发分析（无音频可分析）

---

## Bug Condition (Formal)

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type TemplateOperation
  OUTPUT: boolean
  
  // Returns true when the operation should trigger auto-analysis but doesn't
  RETURN (X.operation = "audio_upload")
      OR (X.operation = "status_change" 
          AND X.newStatus = "published" 
          AND X.template.preview_url IS NOT NULL
          AND X.template.analysis_status IN ("pending", "failed"))
END FUNCTION
```

### Property Specification - Fix Checking

```pascal
// Property: Fix Checking - Auto Analysis Trigger
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleOperation'(X)
  ASSERT result.template.analysis_status = "analyzing"
     AND analysisTriggered(result) = true
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleOperation(X) = handleOperation'(X)
END FOR
```

This ensures that for all non-buggy inputs (manual analysis, manual fill, non-publish status changes, already-completed analysis, no-audio templates), the fixed code behaves identically to the original.
