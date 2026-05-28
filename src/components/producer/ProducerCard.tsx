'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProducerSummary } from '@/types/producer';

interface ProducerCardProps {
  producer: ProducerSummary;
}

export default function ProducerCard({ producer }: ProducerCardProps) {
  const [hovered, setHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    background: 'var(--hc-panel)',
    borderRadius: 14,
    padding: 20,
    border: hovered ? '1px solid var(--hc-border-strong)' : '1px solid var(--hc-border)',
    boxShadow: hovered
      ? '0 18px 44px rgba(0,0,0,0.22)'
      : 'none',
    transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    transform: hovered ? 'translateY(-3px)' : 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  };

  const avatarStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: producer.avatarUrl
      ? `url(${producer.avatarUrl}) center/cover`
      : 'linear-gradient(135deg, #ceff35, #52d6c6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    color: '#08090c',
    marginBottom: 12,
    flexShrink: 0,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 850,
    color: 'var(--hc-text)',
    marginBottom: 8,
    fontFamily: 'var(--hc-font)',
  };

  const tagsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  };

  const tagStyle: React.CSSProperties = {
    padding: '3px 10px',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--hc-text-muted)',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 10,
  };

  const metaStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--hc-text-weak)',
    fontFamily: 'var(--hc-font)',
  };

  return (
    <Link
      href={`/producers/${producer.id}`}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={avatarStyle}>
        {!producer.avatarUrl && producer.displayName.charAt(0)}
      </div>
      <div style={nameStyle}>{producer.displayName}</div>
      <div style={tagsContainerStyle}>
        {producer.styleTags.slice(0, 3).map((tag) => (
          <span key={tag} style={tagStyle}>{tag}</span>
        ))}
      </div>
      <div style={metaStyle}>
        {producer.templateCount} 个模板
      </div>
    </Link>
  );
}
