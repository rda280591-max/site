// ORBIT — تایپ‌های عمومی
export type ID = string;
export type Timestamp = number;
export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Source {
  id: ID;
  name: string;
  url?: string;
  logoUrl?: string;
}

export type ThemeMode = 'dark' | 'light' | 'system';
export type NetworkStatus = 'online' | 'offline' | 'unknown';
export type VoidFn = () => void;

export interface Option<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}