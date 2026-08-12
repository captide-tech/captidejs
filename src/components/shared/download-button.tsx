import React from 'react';
import ToolbarButton from '@components/shared/toolbar-button';
import { DownloadIcon } from '@components/shared/icons';

interface DownloadButtonProps {
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A simple icon-only download button component
 */
const DownloadButton: React.FC<DownloadButtonProps> = ({
  onClick,
  style = {},
  className = ''
}) => (
  <ToolbarButton
    onClick={onClick}
    title="Download PDF"
    style={style}
    className={className}
  >
    <DownloadIcon />
  </ToolbarButton>
);

export default DownloadButton;
