'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getAvatarInitial } from '@/lib/account/profile';
import { compressImageForUpload } from '@/lib/image/browserCompression';
import { supabase } from '@/lib/supabase/client';

type ProfileData = {
  email: string;
  username: string;
  avatarUrl: string | null;
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
      const compressedFile = await compressImageForUpload(file, {
        maxBytes: 2 * 1024 * 1024,
        outputName: 'avatar.webp',
      });
      const formData = new FormData();
      formData.append('avatar', compressedFile);

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
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '网络连接失败，请稍后重试');
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
    <div className="profile-settings">
      <form onSubmit={handleProfileSubmit} className="profile-card">
        <div className="profile-head">
          <label className="avatar-picker">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            <div className="avatar">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="头像" /> : initial}
            </div>
            <span>{uploadingAvatar ? '...' : '+'}</span>
          </label>
          <div>
            <h2>{profile?.username || username || '用户'}</h2>
            <p>{profile?.email || user?.email}</p>
            <small>点击头像可上传 JPG、PNG 或 WebP。</small>
          </div>
        </div>

        <label className="field">
          <span>用户名</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
        </label>

        {(profileError || profileMessage) && (
          <div className={profileError ? 'message error' : 'message success'}>{profileError || profileMessage}</div>
        )}

        <button type="submit" disabled={savingProfile} className="profile-button">
          {savingProfile ? '保存中...' : '保存资料'}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="profile-card">
        <h2>修改密码</h2>
        <div className="field-stack">
          <label className="field">
            <span>新密码</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>确认新密码</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          </label>
        </div>

        {(passwordError || passwordMessage) && (
          <div className={passwordError ? 'message error' : 'message success'}>{passwordError || passwordMessage}</div>
        )}

        <button type="submit" disabled={savingPassword} className="profile-button">
          {savingPassword ? '更新中...' : '更新密码'}
        </button>
      </form>

      <style>{`
        .profile-settings {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 18px;
          margin-bottom: 24px;
        }

        .profile-card {
          border: 1px solid var(--hc-line);
          border-radius: var(--hc-radius-lg);
          background: rgba(24, 26, 34, .88);
          box-shadow: var(--hc-shadow);
          padding: 22px;
        }

        .profile-card h2 {
          margin: 0 0 18px;
          color: var(--hc-text);
          font-size: 20px;
        }

        .profile-head {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .avatar-picker {
          position: relative;
          width: 72px;
          height: 72px;
          flex: 0 0 auto;
          cursor: pointer;
        }

        .avatar-picker input {
          display: none;
        }

        .avatar {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 50%;
          border: 1px solid rgba(206,255,53,.34);
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
          font-size: 28px;
          font-weight: 950;
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-picker span {
          position: absolute;
          right: -2px;
          bottom: -2px;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border: 1px solid var(--hc-line);
          border-radius: 50%;
          background: #11151a;
          color: var(--hc-lime);
          font-weight: 950;
        }

        .profile-head h2 {
          margin: 0 0 6px;
        }

        .profile-head p {
          margin: 0;
          color: var(--hc-muted);
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .profile-head small {
          display: block;
          margin-top: 6px;
          color: var(--hc-muted);
          font-size: 12px;
        }

        .field-stack {
          display: grid;
          gap: 14px;
        }

        .field {
          display: grid;
          gap: 8px;
          color: var(--hc-text);
          font-size: 13px;
          font-weight: 900;
        }

        .field input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--hc-line);
          border-radius: 12px;
          background: #0d0f14;
          color: var(--hc-text);
          padding: 12px 14px;
          font-size: 14px;
          outline: none;
        }

        .profile-button {
          margin-top: 18px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
          padding: 11px 18px;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
        }

        .profile-button:disabled {
          cursor: not-allowed;
          opacity: .58;
        }

        .message {
          margin-top: 12px;
          font-size: 13px;
          font-weight: 800;
        }

        .message.success {
          color: var(--hc-lime);
        }

        .message.error {
          color: #ff8b76;
        }
      `}</style>
    </div>
  );
}
