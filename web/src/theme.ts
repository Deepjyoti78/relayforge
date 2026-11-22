export type ThemeMode = 'light' | 'dark';
export type ThemeName = 'vercel' | 'supabase' | 'claude';

export interface ThemeOption {
  id: ThemeName;
  name: string;
  tagline: string;
  accentColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    tagline: 'Sleek Monochrome',
    accentColor: '#09090B',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    tagline: 'Emerald Tech',
    accentColor: '#10B981',
  },
  {
    id: 'claude',
    name: 'Claude',
    tagline: 'Warm Terracotta',
    accentColor: '#D97706',
  },
];

export function getStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'vercel';
  try {
    const stored = localStorage.getItem('rf_active_theme');
    if (stored === 'supabase' || stored === 'claude' || stored === 'vercel') {
      return stored;
    }
  } catch {}
  return 'vercel';
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem('rf_theme_mode');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {}
  return 'light';
}

export function applyTheme(theme: ThemeName, mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  root.setAttribute('data-theme', theme);
  
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  try {
    localStorage.setItem('rf_active_theme', theme);
    localStorage.setItem('rf_theme_mode', mode);
  } catch {}
}
