// types/producer.ts - 音乐老师/制作人类型定义

export interface ProducerCollaboratorWorks {
  name: string;
  works: string[];
}

/** 制作人完整信息 */
export interface ProducerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  styleTags: string[];
  representativeWorks: string[];
  useCases: string[];
  collaborators: string[];
  collaboratorWorks: ProducerCollaboratorWorks[];
  templateCount: number;
  totalDownloads: number;
  totalSales?: number;
  joinedAt: string;
}

/** 制作人摘要信息（列表/卡片用） */
export interface ProducerSummary {
  id: string;
  displayName: string;
  avatarUrl?: string;
  styleTags: string[];
  representativeWorks?: string[];
  templateCount: number;
}

/** 制作人模板查询参数 */
export interface ProducerTemplatesQuery {
  genre?: string;
  page?: number;
  pageSize?: number;
}
