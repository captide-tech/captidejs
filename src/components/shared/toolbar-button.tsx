import React from 'react';

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

const IDLE_BACKGROUND = 'rgba(255, 255, 255, 0.9)';
const HOVER_BACKGROUND = '#f8fafc';
const ACTIVE_BACKGROUND = '#f1f5f9';

/**
 * The shared look of every control overlaid on the document.
 */
const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  children,
  isActive,
  disabled = false,
  style = {},
  className = ''
}) => {
  const background = isActive ? ACTIVE_BACKGROUND : IDLE_BACKGROUND;

  const buttonStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    backgroundColor: background,
    backdropFilter: 'blur(4px)',
    color: '#475569',
    border: '1px solid rgba(203, 213, 225, 0.5)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'background-color 0.2s ease',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    ...style
  };

  const handleMouseOver = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.currentTarget.style.backgroundColor = HOVER_BACKGROUND;
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
