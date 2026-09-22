// ORBIT — تایپ‌های یادداشت
import type { ID, Timestamp } from './common';

export interface Note {
  id: ID;
  title: string;
  body: string;
  tags: string[];
  linkedArticleId?: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPinned?: boolean;
}

export interface NoteDraft {
  title: string;
  body: string;
  tags: string[];
  linkedArticleId?: ID;
}