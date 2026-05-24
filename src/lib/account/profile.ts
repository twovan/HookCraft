type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

type SimpleValidationResult =
  | { ok: true }
  | { ok: false; error: string };

type UserLike = {
  id: string;
  user_metadata?: {
    username?: unknown;
    display_name?: unknown;
    avatar_url?: unknown;
  };
};

type ListUsersResult = {
  data?: { users?: UserLike[] };
  error?: unknown;
};

type ListUsers = (params: { page: number; perPage: number }) => Promise<ListUsersResult>;

export function validateUsername(username: string): ValidationResult {
  const value = username.trim();

  if (!value) {
    return { ok: false, error: '请输入用户名' };
  }

  if (value.length > 20) {
    return { ok: false, error: '用户名不能超过 20 个字符' };
  }

  return { ok: true, value };
}

export function validateAvatarFile(file: { type: string; size: number }): SimpleValidationResult {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const maxSize = 2 * 1024 * 1024;

  if (!allowedTypes.has(file.type)) {
    return { ok: false, error: '请上传 JPG、PNG 或 WebP 图片' };
  }

  if (file.size > maxSize) {
    return { ok: false, error: '头像图片不能超过 2MB' };
  }

  return { ok: true };
}

export function buildProfileMetadata(
  currentMetadata: Record<string, unknown>,
  updates: { username: string; avatarUrl?: string | null },
): Record<string, unknown> {
  const avatarUrl = updates.avatarUrl ?? currentMetadata.avatar_url ?? null;

  return {
    ...currentMetadata,
    username: updates.username,
    display_name: updates.username,
    avatar_url: avatarUrl || null,
  };
}

export function isUsernameTaken(
  users: UserLike[],
  username: string,
  currentUserId: string,
): boolean {
  const normalized = username.trim().toLowerCase();

  return users.some((user) => {
    if (user.id === currentUserId) return false;

    const existing = String(
      user.user_metadata?.username ?? user.user_metadata?.display_name ?? '',
    )
      .trim()
      .toLowerCase();

    return existing === normalized;
  });
}

export async function hasUsernameConflict(
  listUsers: ListUsers,
  username: string,
  currentUserId: string,
  perPage = 1000,
): Promise<boolean> {
  let page = 1;

  while (true) {
    const { data, error } = await listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    if (isUsernameTaken(users, username, currentUserId)) {
      return true;
    }

    if (users.length < perPage) {
      return false;
    }

    page += 1;
  }
}

export function getAvatarInitial({
  username,
  email,
}: {
  username?: string | null;
  email?: string | null;
}): string {
  const source = username?.trim() || email?.trim() || 'U';
  return source.charAt(0).toUpperCase();
}
