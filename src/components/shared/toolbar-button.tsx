import React from 'react';
import {
  TOOLBAR_ACTIVE_BACKGROUND,
  TOOLBAR_HOVER_BACKGROUND,
  TOOLBAR_IDLE_BACKGROUND,
  toolbarSurfaceStyle
} from '@components/shared/toolbar-styles';

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
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
  isActive,
  disabled = false,
  style = {},
  className = ''
}) => {
  const background = isActive ? TOOLBAR_ACTIVE_BACKGROUND : TOOLBAR_IDLE_BACKGROUND;

  const buttonStyle: React.CSSProperties = {
    ...toolbarSurfaceStyle,
    width: '32px',
    flexShrink: 0,
    backgroundColor: background,
    transition: 'background-color 0.2s ease',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    ...style
  };

  const handleMouseOver = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.currentTarget.style.backgroundColor = TOOLBAR_HOVER_BACKGROUND;
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
