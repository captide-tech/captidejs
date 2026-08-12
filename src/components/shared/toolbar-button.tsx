import React from 'react';
import {
  TOOLBAR_ACTIVE_BACKGROUND,
  TOOLBAR_CONTROL_SIZE,
  TOOLBAR_FOREGROUND,
  TOOLBAR_GHOST_ACTIVE_BACKGROUND,
  TOOLBAR_GHOST_CONTROL_SIZE,
  TOOLBAR_GHOST_HOVER_BACKGROUND,
  TOOLBAR_HOVER_BACKGROUND,
  TOOLBAR_IDLE_BACKGROUND,
  TOOLBAR_MUTED_FOREGROUND,
  toolbarSurfaceStyle
} from '@components/shared/toolbar-styles';

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  /** `ghost` is for controls nested inside another toolbar surface. */
  variant?: 'surface' | 'ghost';
  /** Only set this for buttons that toggle something; it drives `aria-pressed`. */
  isActive?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  children,
  variant = 'surface',
  isActive,
  disabled = false,
  style = {},
  className = ''
}) => {
  const isGhost = variant === 'ghost';
  const idleBackground = isGhost ? 'transparent' : TOOLBAR_IDLE_BACKGROUND;
  const activeBackground = isGhost ? TOOLBAR_GHOST_ACTIVE_BACKGROUND : TOOLBAR_ACTIVE_BACKGROUND;
  const hoverBackground = isGhost ? TOOLBAR_GHOST_HOVER_BACKGROUND : TOOLBAR_HOVER_BACKGROUND;
  const background = isActive ? activeBackground : idleBackground;
  const size = isGhost ? TOOLBAR_GHOST_CONTROL_SIZE : TOOLBAR_CONTROL_SIZE;

  const ghostStyle: React.CSSProperties = {
    border: 'none',
    boxShadow: 'none',
    backdropFilter: 'none',
    borderRadius: '4px',
    color: isActive ? TOOLBAR_FOREGROUND : TOOLBAR_MUTED_FOREGROUND
  };

  const buttonStyle: React.CSSProperties = {
    ...toolbarSurfaceStyle,
    ...(isGhost ? ghostStyle : {}),
    width: `${size}px`,
    height: `${size}px`,
    flexShrink: 0,
    backgroundColor: background,
    transition: 'background-color 0.2s ease',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    ...style
  };

  const handleMouseOver = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.currentTarget.style.backgroundColor = hoverBackground;
  };

  const handleMouseOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.backgroundColor = background;
  };

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      disabled={disabled}
      style={buttonStyle}
      className={className}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      {children}
    </button>
  );
};

export default ToolbarButton;
