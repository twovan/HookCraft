'use client';

import { ReactNode, useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopBar from '@/components/admin/AdminTopBar';
import { usePathname, useRouter } from 'next/navigation';

const pageTitles: Record<string, { title: string; breadcrumb: string }> = {
  '/admin': { title: '数据看板', breadcrumb: '首页 / 概览' },
  '/admin/templates': { title: '模板管理', breadcrumb: '首页 / 内容管理 / 模板管理' },
  '/admin/review': { title: '内容审核', breadcrumb: '首页 / 内容管理 / 内容审核' },
  '/admin/categories': { title: '分类管理', breadcrumb: '首页 / 内容管理 / 分类管理' },
  '/admin/users': { title: '用户管理', breadcrumb: '首页 / 用户管理 / 用户列表' },
  '/admin/producers': { title: '制作人管理', breadcrumb: '首页 / 用户管理 / 制作人' },
  '/admin/membership': { title: '会员管理', breadcrumb: '首页 / 用户管理 / 会员管理' },
  '/admin/orders': { title: '订单管理', breadcrumb: '首页 / 交易管理 / 订单管理' },
  '/admin/revenue': { title: '收入结算', breadcrumb: '首页 / 交易管理 / 收入结算' },
  '/admin/ai-tasks': { title: 'AI 任务监控', breadcrumb: '首页 / AI 管理 / AI 任务' },
  '/admin/style-dna': { title: 'Style DNA 分析', breadcrumb: '首页 / AI 管理 / Style DNA' },
  '/admin/generated-songs': { title: '生成歌曲管理', breadcrumb: '首页 / AI 管理 / 生成歌曲' },
  '/admin/credits': { title: 'Credits 管理', breadcrumb: '首页 / AI 管理 / Credits' },
  '/admin/sensitive-words': { title: '敏感词管理', breadcrumb: '首页 / 内容管理 / 敏感词管理' },
  '/admin/settings': { title: '系统设置', breadcrumb: '首页 / 系统 / 系统设置' },
  '/admin/editor-features': { title: '编辑器开关', breadcrumb: '首页 / 系统 / 编辑器开关' },
  '/admin/logs': { title: '操作日志', breadcrumb: '首页 / 系统 / 操作日志' },
  '/admin/sensitivity-logs': { title: '敏感词检测日志', breadcrumb: '首页 / 系统 / 敏感词检测日志' },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    // 登录页不需要检查认证
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    // 检查管理员会话
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/auth/session');
        if (res.ok) {
          setAuthenticated(true);
        } else {
          router.replace('/admin/login');
        }
      } catch {
        router.replace('/admin/login');
      } finally {
        setChecking(false);
      }
    };

    checkSession();
  }, [isLoginPage, router]);

  // 登录页：不显示侧边栏和顶栏
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 检查中：显示加载状态
  if (checking) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle}>加载中...</div>
      </div>
    );
  }

  // 未认证：不渲染内容（正在跳转到登录页）
  if (!authenticated) {
    return null;
  }

  const pageInfo = pageTitles[pathname] || { title: '管理后台', breadcrumb: '首页' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={mainStyle}>
        <AdminTopBar title={pageInfo.title} breadcrumb={pageInfo.breadcrumb} />
        <div style={contentStyle}>
          {children}
        </div>
      </main>
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  flex: 1,
  marginLeft: 240,
  background: '#f0f2f5',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: '24px 32px',
};

const loadingStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f0f2f5',
};

const spinnerStyle: React.CSSProperties = {
  fontSize: 16,
  color: '#6b7280',
};
