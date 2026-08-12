import type { CSSProperties } from 'react';

/**
 * The shared look of every control overlaid on the document.
 */

// These stay inline rather than as Tailwind classes: the package ships no
// stylesheet and host apps don't scan node_modules, so utility classes silently
// fall back to whatever the host's cascade paints on every bordered element.
export const TOOLBAR_BORDER_COLOR = 'var(--captidejs-toolbar-border-color, #cbd5e1)';
export const TOOLBAR_IDLE_BACKGROUND = 'rgba(255, 255, 255, 0.9)';
export const TOOLBAR_HOVER_BACKGROUND = '#f8fafc';
export const TOOLBAR_ACTIVE_BACKGROUND = '#f1f5f9';
export const TOOLBAR_FOREGROUND = '#475569';

export const toolbarSurfaceStyle: CSSProperties = {
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  backgroundColor: TOOLBAR_IDLE_BACKGROUND,
  backdropFilter: 'blur(4px)',
  color: TOOLBAR_FOREGROUND,
  border: `1px solid ${TOOLBAR_BORDER_COLOR}`,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  fontWeight: 500
};

export const toolbarLabelStyle: CSSProperties = {
  padding: '0 12px',
  fontSize: '14px'
};
