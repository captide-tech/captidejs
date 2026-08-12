import React, { useEffect, useRef } from 'react';
import ToolbarButton from '@components/shared/toolbar-button';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, SearchIcon } from '@components/shared/icons';
import {
  TOOLBAR_FIELD_MAX_WIDTH,
  TOOLBAR_MUTED_FOREGROUND,
  toolbarSurfaceStyle
} from '@components/shared/toolbar-styles';
import type { DocumentSearchController } from '@types';

const INPUT_CLASS_NAME = 'captidejs-search-input';

interface SearchBarProps {
  search: DocumentSearchController;
}

const containerStyle: React.CSSProperties = {
  ...toolbarSurfaceStyle,
  flex: '1 1 auto',
  minWidth: 0,
  maxWidth: `${TOOLBAR_FIELD_MAX_WIDTH}px`,
  justifyContent: 'flex-start',
  gap: '4px',
  padding: '0 4px 0 8px'
};

const iconStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  color: TOOLBAR_MUTED_FOREGROUND
};

const inputStyle: React.CSSProperties = {
  minWidth: '40px',
  flex: '1 1 auto',
  height: '100%',
  padding: '0 4px',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: 400
};

const statusStyle: React.CSSProperties = {
  flexShrink: 1,
  minWidth: 0,
  color: TOOLBAR_MUTED_FOREGROUND,
  fontSize: '12px',
  fontWeight: 400,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const separatorStyle: React.CSSProperties = {
  flexShrink: 0,
  width: '1px',
  height: '16px',
  margin: '0 2px',
  backgroundColor: '#e2e8f0'
};

const caseButtonStyle: React.CSSProperties = {
  fontSize: '11px',
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
      <span style={iconStyle} aria-hidden="true">
        <SearchIcon />
      </span>
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
        variant="ghost"
        onClick={search.toggleCaseSensitive}
        title="Match case"
        isActive={search.caseSensitive}
        style={caseButtonStyle}
      >
        Aa
      </ToolbarButton>
      <ToolbarButton
        variant="ghost"
        onClick={search.findPrevious}
        title="Previous match"
        disabled={!hasMatches}
      >
        <ChevronUpIcon />
      </ToolbarButton>
      <ToolbarButton
        variant="ghost"
        onClick={search.findNext}
        title="Next match"
        disabled={!hasMatches}
      >
        <ChevronDownIcon />
      </ToolbarButton>
      <span style={separatorStyle} />
      <ToolbarButton variant="ghost" onClick={search.close} title="Close find bar">
        <CloseIcon />
      </ToolbarButton>
    </div>
  );
};

export default SearchBar;
