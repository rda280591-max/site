// ORBIT — common types
export type ID = string;
export type Timestamp = number;
export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';


export interface Source {
  id: ID;
  name: string;
  url?: string;
  logoUrl?: string;
}

export type ThemeMode = 'dark' | 'light' | 'system';
export type VoidFn = () => void;

