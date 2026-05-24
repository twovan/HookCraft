'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getAvatarInitial } from '@/lib/account/profile';
import { supabase } from '@/lib/supabase/client';

type ProfileData = {
  email: string;
  username: string;
  avatarUrl: string | null;
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a2e',
  borderRadius: 20,
  padding: 24,
  border: '1px solid #2a2a40',
  boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #2a2a40',
  background: '#11111d',
  color: '#e8e8f0',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 18,
  border: 'none',
  background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

export default function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [username, setUsername] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      const res = await fetchWithAuth('/api/account/profile');
      if (!res.ok) return;

      const data = await res.json();
      if (ignore) return;

      setProfile(data);
      setUsername(data.username || user?.email?.split('@')[0] || '');
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [user?.email]);

  const initial = useMemo(
    () => getAvatarInitial({ username: profile?.username || username, email: profile?.email || user?.email }),
    [profile?.email, profile?.username, user?.email, username],
  );

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const res = await fetchWithAuth('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ username, avatarUrl: profile?.avatarUrl ?? null }),
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || '保存个人信息失败');
        return;
      }

      setProfile(data);
      setUsername(data.username);
      await refreshUser();
      setProfileMessage('个人信息已保存');
    } catch {
      setProfileError('网络连接失败，请稍后重试');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetchWithAuth('/api/account/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || '头像上传失败');
        return;
      }

      setProfile((current) => current ? { ...current, avatarUrl: data.avatarUrl } : current);
      await refreshUser();
      setProfileMessage('头像已更新');
    } catch {
      setProfileError('网络连接失败，请稍后重试');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    if (password.length < 8) {
      setPasswordError('密码至少需要 8 位');
      setSavingPassword(false);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setPasswordMessage('密码已更新');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
      <form onSubmit={handleProfileSubmit} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
          <label style={{ position: 'relative', width: 72, height: 72, flex: '0 0 auto', cursor: uploadingAvatar ? 'not-allowed' : 'pointer' }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              style={{ display: 'none' }}
            />
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
                border: '2px solid rgba(117, 54, 213, 0.45)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 800,
                overflow: 'hidden',
              }}
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="头像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initial
              )}
            </div>
            <span
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#11111d',
                border: '1px solid #2a2a40',
                color: '#e8e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {uploadingAvatar ? '...' : '+'}
            </span>
          </label>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: '0 0 6px', color: '#e8e8f0', fontSize: 20 }}>
              {profile?.username || username || '用户'}
            </h2>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 13, overflowWrap: 'anywhere' }}>
              {profile?.email || user?.email}
            </p>
            <p style={{ margin: '6px 0 0', color: '#7c8296', fontSize: 12 }}>
              点击头像可上传 JPG、PNG 或 WebP
            </p>
          </div>
        </div>

        <label style={{ display: 'block', color: '#e8e8f0', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          用户名
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          style={inputStyle}
        />

        {(profileError || profileMessage) && (
          <div style={{ marginTop: 12, color: profileError ? '#f87171' : '#34d399', fontSize: 13 }}>
            {profileError || profileMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={savingProfile}
          style={{ ...buttonStyle, marginTop: 18, opacity: savingProfile ? 0.6 : 1, cursor: savingProfile ? 'not-allowed' : 'pointer' }}
        >
          {savingProfile ? '保存中...' : '保存资料'}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} style={cardStyle}>
        <h2 style={{ margin: '0 0 18px', color: '#e8e8f0', fontSize: 20 }}>修改密码</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: '#e8e8f0', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              新密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#e8e8f0', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              确认新密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
        </div>

        {(passwordError || passwordMessage) && (
          <div style={{ marginTop: 12, color: passwordError ? '#f87171' : '#34d399', fontSize: 13 }}>
            {passwordError || passwordMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={savingPassword}
          style={{ ...buttonStyle, marginTop: 18, opacity: savingPassword ? 0.6 : 1, cursor: savingPassword ? 'not-allowed' : 'pointer' }}
        >
          {savingPassword ? '更新中...' : '更新密码'}
        </button>
      </form>
    </div>
  );
}
