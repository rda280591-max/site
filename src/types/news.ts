// ORBIT — تایپ‌های خبر
import type { ID, Source, Timestamp } from './common';
import type { NewsCategoryId } from '@/core/config';

export interface Article {
  id: ID;
  title: string;
  summary: string;
  content?: string;
  url: string;
  imageUrl?: string;
  author?: string;
  source: Source;
  category: NewsCategoryId;
  tags: string[];
  publishedAt: Timestamp;
  fetchedAt: Timestamp;
  relevance?: number;
  isRead?: boolean;
  isBookmarked?: boolean;
}

export interface NewsQuery {
  category?: NewsCategoryId | 'all';
  search?: string;
  from?: Timestamp;
  to?: Timestamp;
  page?: number;
  pageSize?: number;
  sortBy?: 'publishedAt' | 'relevance';
}

export interface NewsResponse {
  articles: Article[];
  total: number;
  fromCache: boolean;
  provider: 'newsapi' | 'rss' | 'mock';
}

export interface CategoryStat {
  category: NewsCategoryId;
  count: number;
  lastUpdated: Timestamp;
}