import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getContentPage,
  type ContentPageEntry,
} from '@/lib/contentPages';
import { readContentPagesSettings } from '@/lib/contentPages.server';

export const dynamic = 'force-dynamic';

const siblingLinks = [
  { href: '/terms', label: '服务条款' },
  { href: '/privacy', label: '隐私政策' },
  { href: '/copyright', label: '版权声明' },
  { href: '/help', label: '帮助中心' },
  { href: '/contact', label: '联系我们' },
  { href: '/faq', label: '常见问题' },
];

export default async function ContentPage({ params }: { params: { contentPage: string } }) {
  const settings = await readContentPagesSettings();
  const page = getContentPage(settings, params.contentPage);

  if (!page) notFound();

  return (
    <main className="hc-content-page">
      <section className="content-hero">
        <div>
          <p className="content-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="content-summary">{page.summary}</p>
          <span className="content-updated">更新日期：{page.updatedAt}</span>
        </div>
      </section>

      <section className="content-layout">
        <aside className="content-nav" aria-label="内容页面导航">
          <span>{page.group === 'legal' ? '法律' : '支持'}</span>
          {siblingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={link.href === `/${page.slug}` ? 'active' : ''}
            >
              {link.label}
            </Link>
          ))}
        </aside>

        <article className="content-document">
          <RenderedBody page={page} />
        </article>
      </section>

      <style>{`
        .hc-content-page {
          min-height: 100vh;
          padding: 132px 48px 88px;
          background:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
            radial-gradient(circle at 82% 14%, rgba(206,255,53,.12), transparent 320px),
            radial-gradient(circle at 14% 28%, rgba(82,214,198,.08), transparent 360px),
            #08090c;
          background-size: 72px 72px, 72px 72px, auto, auto, auto;
          color: var(--hc-text);
        }

        .content-hero,
        .content-layout {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .content-hero {
          padding-bottom: 34px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .content-eyebrow {
          margin: 0 0 12px;
          color: var(--hc-lime);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .content-hero h1 {
          margin: 0;
          max-width: 780px;
          color: #fff;
          font-size: 56px;
          line-height: 1.05;
          letter-spacing: 0;
        }

        .content-summary {
          margin: 20px 0 0;
          max-width: 760px;
          color: rgba(244,241,234,.72);
          font-size: 18px;
          line-height: 1.8;
        }

        .content-updated {
          display: inline-flex;
          margin-top: 18px;
          padding: 7px 12px;
          border: 1px solid rgba(206,255,53,.22);
          border-radius: 999px;
          background: rgba(206,255,53,.08);
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 800;
        }

        .content-layout {
          display: grid;
          grid-template-columns: 230px minmax(0, 1fr);
          gap: 42px;
          padding-top: 42px;
        }

        .content-nav {
          position: sticky;
          top: 108px;
          align-self: start;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 8px;
          background: rgba(18,20,27,.7);
          backdrop-filter: blur(16px);
        }

        .content-nav span {
          margin-bottom: 6px;
          color: rgba(244,241,234,.56);
          font-size: 12px;
          font-weight: 900;
        }

        .content-nav a {
          padding: 10px 12px;
          border-radius: 7px;
          color: rgba(244,241,234,.68);
          text-decoration: none;
          font-size: 14px;
          font-weight: 800;
        }

        .content-nav a.active,
        .content-nav a:hover {
          background: rgba(206,255,53,.1);
          color: var(--hc-lime);
        }

        .content-document {
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(24,26,34,.88), rgba(12,14,19,.9));
          padding: 38px 44px;
          box-shadow: 0 28px 80px rgba(0,0,0,.28);
        }

        .content-block + .content-block {
          margin-top: 34px;
          padding-top: 30px;
          border-top: 1px solid rgba(255,255,255,.08);
        }

        .content-block h2 {
          margin: 0 0 14px;
          color: #fff;
          font-size: 24px;
          line-height: 1.3;
          letter-spacing: 0;
        }

        .content-block p,
        .content-block li {
          color: rgba(244,241,234,.74);
          font-size: 15px;
          line-height: 1.9;
        }

        .content-block p {
          margin: 10px 0 0;
        }

        .content-block ul {
          margin: 12px 0 0;
          padding-left: 20px;
        }

        @media (max-width: 820px) {
          .hc-content-page {
            padding: 108px 20px 64px;
          }

          .content-hero h1 {
            font-size: 38px;
          }

          .content-summary {
            font-size: 15px;
          }

          .content-layout {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .content-nav {
            position: static;
            flex-direction: row;
            overflow-x: auto;
          }

          .content-nav span {
            display: none;
          }

          .content-nav a {
            white-space: nowrap;
          }

          .content-document {
            padding: 26px 22px;
          }
        }
      `}</style>
    </main>
  );
}

function RenderedBody({ page }: { page: ContentPageEntry }) {
  const blocks = parseContentBody(page.body);

  return (
    <>
      {blocks.map((block, index) => (
        <section key={`${block.heading}-${index}`} className="content-block">
          <h2>{block.heading}</h2>
          {block.paragraphs.map((paragraph) => (
            paragraph.kind === 'list'
              ? (
                <ul key={paragraph.items.join('|')}>
                  {paragraph.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )
              : <p key={paragraph.text}>{paragraph.text}</p>
          ))}
        </section>
      ))}
    </>
  );
}

function parseContentBody(body: string) {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const blocks: Array<{
    heading: string;
    paragraphs: Array<{ kind: 'text'; text: string } | { kind: 'list'; items: string[] }>;
  }> = [];

  let current: (typeof blocks)[number] | null = null;
  let pendingList: string[] = [];

  function flushList() {
    if (current && pendingList.length > 0) {
      current.paragraphs.push({ kind: 'list', items: pendingList });
      pendingList = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushList();
      current = { heading: line.replace(/^##\s+/, ''), paragraphs: [] };
      blocks.push(current);
      continue;
    }

    if (!current) {
      current = { heading: '说明', paragraphs: [] };
      blocks.push(current);
    }

    if (line.startsWith('- ')) {
      pendingList.push(line.replace(/^-\s+/, ''));
    } else {
      flushList();
      current.paragraphs.push({ kind: 'text', text: line });
    }
  }

  flushList();
  return blocks;
}
