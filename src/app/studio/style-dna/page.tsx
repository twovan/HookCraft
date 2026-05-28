import Link from 'next/link';

export default function StyleDnaPage() {
  return (
    <main className="hc-shell" style={{ padding: '72px 0 96px' }}>
      <section className="hc-container" style={{ display: 'grid', gap: 18, maxWidth: 860 }}>
        <span
          style={{
            width: 'fit-content',
            border: '1px solid rgba(206, 255, 53, 0.24)',
            borderRadius: 999,
            background: 'rgba(206, 255, 53, 0.08)',
            color: 'var(--hc-lime)',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Style DNA
        </span>
        <h1 style={{ margin: 0, color: 'var(--hc-text)', fontSize: 48, lineHeight: 1.05, fontWeight: 950 }}>
          风格 DNA 工作台
        </h1>
        <p style={{ margin: 0, color: 'var(--hc-text-muted)', fontSize: 16, lineHeight: 1.8 }}>
          风格 DNA 的模板分析、保存与管理入口已迁移到管理台。这里保留稳定入口，避免旧链接打开时出现跳转错误。
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          <Link className="hc-button" href="/admin/style-dna">
            打开风格 DNA 管理台
          </Link>
          <Link className="hc-button hc-button-secondary" href="/studio">
            返回音乐工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
