import React, { useEffect, useRef } from 'react';
import ToolbarButton from '@components/shared/toolbar-button';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '@components/shared/icons';
import { TOOLBAR_BORDER_COLOR, TOOLBAR_IDLE_BACKGROUND } from '@components/shared/toolbar-styles';
import type { DocumentSearchController } from '@types';

const INPUT_CLASS_NAME = 'captidejs-search-input';

interface SearchBarProps {
  search: DocumentSearchController;
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '48px',
  right: '8px',
  zIndex: 9999,
  maxWidth: 'calc(100% - 16px)',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px',
  borderRadius: '6px',
  backgroundColor: TOOLBAR_IDLE_BACKGROUND,
  backdropFilter: 'blur(4px)',
  border: `1px solid ${TOOLBAR_BORDER_COLOR}`,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
};

const inputStyle: React.CSSProperties = {
  width: '176px',
  minWidth: 0,
  flex: '1 1 auto',
  height: '32px',
  padding: '0 8px',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#0f172a',
  fontSize: '14px'
};

const statusStyle: React.CSSProperties = {
  flexShrink: 0,
  minWidth: '76px',
  padding: '0 4px',
  color: '#64748b',
  fontSize: '12px',
  textAlign: 'right',
  whiteSpace: 'nowrap'
};

const caseButtonStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1
};

const getStatusLabel = (search: DocumentSearchController): string => {
  if (!search.query) return '';
  if (search.matchesCount.total > 0) {
    return `${search.matchesCount.current} of ${search.matchesCount.total}`;
  }
  if (search.isPending) return 'Searching…';
  if (search.isNotFound) return 'No matches';
  return '';
};

const SearchBar: React.FC<SearchBarProps> = ({ search }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMatches = search.matchesCount.total > 0;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    input.select();
  }, [search.focusToken]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      search.close();
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (event.shiftKey) {
      search.findPrevious();
      return;
    }
    search.findNext();
  };

  return (
    <div style={containerStyle}>
      <style>{`.${INPUT_CLASS_NAME}::placeholder { color: #94a3b8; }`}</style>
      <input
        ref={inputRef}
        className={INPUT_CLASS_NAME}
        style={inputStyle}
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document"
        aria-label="Find in document"
      />
      <span style={statusStyle}>{getStatusLabel(search)}</span>
      <ToolbarButton
        onClick={search.toggleCaseSensitive}
        title="Match case"
        isActive={search.caseSensitive}
        style={caseButtonStyle}
      >
        Aa
      </ToolbarButton>
      <ToolbarButton
        onClick={search.findPrevious}
        title="Previous match"
        disabled={!hasMatches}
      >
        <ChevronUpIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={search.findNext}
        title="Next match"
        disabled={!hasMatches}
      >
        <ChevronDownIcon />
      </ToolbarButton>
      <ToolbarButton onClick={search.close} title="Close find bar">
        <CloseIcon />
      </ToolbarButton>
    </div>
  );
};

export default SearchBar;
