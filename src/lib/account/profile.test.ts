import { describe, expect, it } from 'vitest';
import {
  buildProfileMetadata,
  getAvatarInitial,
  hasUsernameConflict,
  isUsernameTaken,
  validateAvatarFile,
  validateUsername,
} from './profile';

describe('account profile helpers', () => {
  it('accepts trimmed usernames between 2 and 20 characters', () => {
    expect(validateUsername('  Lyfan  ')).toEqual({ ok: true, value: 'Lyfan' });
  });

  it('rejects blank or overly long usernames', () => {
    expect(validateUsername('   ')).toEqual({ ok: false, error: '请输入用户名' });
    expect(validateUsername('a'.repeat(21))).toEqual({
      ok: false,
      error: '用户名不能超过 20 个字符',
    });
  });

  it('detects another user with the same username case-insensitively', () => {
    const users = [
      { id: 'user-1', user_metadata: { username: 'Alice' } },
      { id: 'user-2', user_metadata: { username: 'Lyfan' } },
    ];

    expect(isUsernameTaken(users, ' lyfan ', 'user-3')).toBe(true);
    expect(isUsernameTaken(users, 'lyfan', 'user-2')).toBe(false);
  });

  it('checks username conflicts across paged auth users', async () => {
    const listUsers = async ({ page }: { page: number; perPage: number }) => ({
      data: {
        users: page === 1
          ? [{ id: 'user-1', user_metadata: { username: 'Alice' } }]
          : [{ id: 'user-2', user_metadata: { username: 'Lyfan' } }],
      },
      error: null,
    });

    await expect(hasUsernameConflict(listUsers, 'lyfan', 'user-3', 1)).resolves.toBe(true);
  });

  it('uses username or email to produce a default avatar initial', () => {
    expect(getAvatarInitial({ username: 'Lyfan', email: 'demo@example.com' })).toBe('L');
    expect(getAvatarInitial({ username: '', email: 'music@example.com' })).toBe('M');
    expect(getAvatarInitial({ username: '', email: '' })).toBe('U');
  });

  it('accepts common image avatar files up to 2MB', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 * 1024 })).toEqual({ ok: true });
  });

  it('rejects unsupported or oversized avatar files', () => {
    expect(validateAvatarFile({ type: 'text/plain', size: 100 })).toEqual({
      ok: false,
      error: '请上传 JPG、PNG 或 WebP 图片',
    });
    expect(validateAvatarFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toEqual({
      ok: false,
      error: '头像图片不能超过 2MB',
    });
  });

  it('preserves the latest avatar url while updating username', () => {
    expect(
      buildProfileMetadata(
        { username: 'Old', avatar_url: 'https://cdn.example.com/avatar.png' },
        { username: 'New' },
      ),
    ).toEqual({
      username: 'New',
      display_name: 'New',
      avatar_url: 'https://cdn.example.com/avatar.png',
    });
  });
});
