// errors.ts - 统一错误处理层

/**
 * 应用层标准错误格式
 * 所有数据库操作错误统一转换为此格式
 */
export interface AppError {
  code: string;
  message: string;
  table: string;
  operation: string;
}

/**
 * Supabase SDK PostgrestError 的最小接口
 * 兼容 @supabase/supabase-js 返回的错误对象
 */
export interface PostgrestError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/** 常见 PostgreSQL 错误码到用户友好消息的映射 */
const ERROR_CODE_MAP: Record<string, string> = {
  'PGRST301': '查询超时',
  '23505': '数据已存在（唯一约束冲突）',
  '23503': '关联数据不存在（外键约束）',
  '42501': '无权执行此操作',
};

/**
 * 将 Supabase SDK 错误转换为应用层标准 AppError
 *
 * 确保输出始终包含非空的 code 和 message 字段：
 * - code: 使用原始错误码，缺失时回退到 'UNKNOWN'
 * - message: 优先使用映射的友好消息，其次使用原始 message，最后回退到默认消息
 */
export function toAppError(
  error: PostgrestError,
  table: string,
  operation: string
): AppError {
  const code = error.code?.trim() || 'UNKNOWN';
  const mappedMessage = Object.prototype.hasOwnProperty.call(ERROR_CODE_MAP, code)
    ? ERROR_CODE_MAP[code]
    : undefined;
  const message = mappedMessage || error.message?.trim() || '数据库操作失败';

  return {
    code,
    message,
    table,
    operation,
  };
}
