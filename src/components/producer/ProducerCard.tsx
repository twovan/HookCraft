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
    background: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    border: '1px solid #2a2a40',
    boxShadow: hovered
      ? '0 12px 40px rgba(117, 54, 213,0.2)'
      : '0 4px 20px rgba(0,0,0,0.04)',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: hovered ? 'translateY(-4px)' : 'none',
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
      : 'linear-gradient(135deg, #7536d5, #5a2db8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    color: 'white',
    marginBottom: 12,
    flexShrink: 0,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: '#e8e8f0',
    marginBottom: 8,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const tagsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  };

  const tagStyle: React.CSSProperties = {
    padding: '3px 10px',
    background: 'rgba(117, 54, 213, 0.15)',
    color: '#7536d5',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 10,
  };

  const metaStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#999',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
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
