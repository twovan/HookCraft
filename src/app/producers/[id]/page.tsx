'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { ProducerProfile } from '@/types/producer';

interface TemplateItem {
  id: string;
  name: string;
  genre: string;
  category: string;
  previewUrl?: string;
  price?: number;
}

export default function ProducerProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [producer, setProducer] = useState<ProducerProfile | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'other'>('templates');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    fetchProducer();
    fetchTemplates();
  }, [id]);

  useEffect(() => {
    fetchTemplates();
  }, [selectedGenre]);

  const fetchProducer = async () => {
    try {
      const res = await fetch(`/api/producers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProducer(data.producer);
      } else {
        setError('制作人不存在');
      }
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedGenre) params.set('genre', selectedGenre);
      const res = await fetch(`/api/producers/${id}/templates?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      // Silently fail
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#999', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  if (error || !producer) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={{ fontSize: 48 }}>🎵</span>
        <span style={{ color: '#999', fontSize: 16 }}>{error || '制作人不存在'}</span>
        <Link href="/" style={{ color: '#7536d5', textDecoration: 'none', fontWeight: 600 }}>← 返回首页</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14' }}>
      {/* Background */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(117, 54, 213,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(117, 54, 213,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        {/* Producer Header */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: 24,
          padding: 32,
          border: '1px solid #2a2a40',
          boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
          marginBottom: 32,
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
        }}>
          {/* Avatar */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: producer.avatarUrl
              ? `url(${producer.avatarUrl}) center/cover`
              : 'linear-gradient(135deg, #7536d5, #5a2db8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            color: 'white',
            flexShrink: 0,
          }}>
            {!producer.avatarUrl && producer.displayName.charAt(0)}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#e8e8f0',
                margin: 0,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}>
                {producer.displayName}
              </h1>
              {/* 认证制作人 badge */}
              <span style={{
                padding: '4px 12px',
                background: 'rgba(117, 54, 213, 0.15)',
                color: '#7536d5',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 12,
                border: '1px solid rgba(117, 54, 213, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                ✓ 认证制作人
              </span>
            </div>

            {producer.bio && (
              <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.6, marginBottom: 12 }}>
                {producer.bio}
              </p>
            )}

            {/* Style tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {producer.styleTags.map((tag) => (
                <span key={tag} style={{
                  padding: '5px 14px',
                  background: 'rgba(117, 54, 213, 0.15)',
                  color: '#7536d5',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 12,
                }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Stats row - 4 items */}
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#7536d5' }}>{producer.templateCount}</div>
                <div style={{ fontSize: 12, color: '#999' }}>模板</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#7536d5' }}>{producer.totalDownloads}</div>
                <div style={{ fontSize: 12, color: '#999' }}>下载量</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#7536d5' }}>{producer.totalSales || 0}</div>
                <div style={{ fontSize: 12, color: '#999' }}>销量</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0' }}>{formatDate(producer.joinedAt)}</div>
                <div style={{ fontSize: 12, color: '#999' }}>入驻时间</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              padding: '10px 20px',
              borderRadius: 20,
              border: 'none',
              background: activeTab === 'templates'
                ? 'linear-gradient(135deg, #7536d5, #5a2db8)'
                : 'white',
              color: activeTab === 'templates' ? 'white' : '#9ca3af',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            模板作品
          </button>
          <button
            onClick={() => setActiveTab('other')}
            style={{
              padding: '10px 20px',
              borderRadius: 20,
              border: 'none',
              background: activeTab === 'other'
                ? 'linear-gradient(135deg, #7536d5, #5a2db8)'
                : 'white',
              color: activeTab === 'other' ? 'white' : '#9ca3af',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            其他内容
          </button>
        </div>

        {activeTab === 'templates' && (
          <>
            {/* Genre filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedGenre(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: !selectedGenre ? 'none' : '1px solid #2a2a40',
                  background: !selectedGenre ? 'rgba(117, 54, 213, 0.15)' : '#1a1a2e',
                  color: !selectedGenre ? '#7536d5' : '#9ca3af',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                全部
              </button>
              {producer.styleTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedGenre(tag)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 16,
                    border: selectedGenre === tag ? 'none' : '1px solid #2a2a40',
                    background: selectedGenre === tag ? 'rgba(117, 54, 213, 0.15)' : '#1a1a2e',
                    color: selectedGenre === tag ? '#7536d5' : '#9ca3af',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Templates grid */}
            {templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>🎵</div>
                <p style={{ fontSize: 14 }}>暂无模板</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                {templates.map((t) => (
                  <Link
                    key={t.id}
                    href={`/templates/${t.id}`}
                    style={{
                      background: '#1a1a2e',
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: hoveredCard === t.id
                        ? '0 8px 30px rgba(117, 54, 213,0.2)'
                        : '0 2px 12px rgba(0,0,0,0.04)',
                      transition: 'all 0.3s ease',
                      transform: hoveredCard === t.id ? 'translateY(-4px)' : 'none',
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                    }}
                    onMouseEnter={() => setHoveredCard(t.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <div style={{
                      height: 120,
                      background: 'linear-gradient(135deg, rgba(117, 54, 213, 0.15), #0d0d14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                    }}>
                      🎵
                    </div>
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0', marginBottom: 6 }}>
                        {t.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <span style={{
                          padding: '3px 8px',
                          background: 'rgba(117, 54, 213, 0.15)',
                          color: '#7536d5',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 8,
                        }}>
                          {t.genre}
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#7536d5' }}>
                        {t.price && t.price > 0 ? `￥${Math.round(t.price / 100)}` : '免费'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'other' && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: '#1a1a2e',
            borderRadius: 20,
            border: '1px solid #2a2a40',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📝</div>
            <p style={{ fontSize: 15, color: '#999' }}>暂无其他内容</p>
          </div>
        )}
      </div>
    </div>
  );
}
