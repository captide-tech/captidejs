import React, { useEffect, useRef } from 'react';
import ToolbarButton from '@components/shared/toolbar-button';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from '@components/shared/icons';
import {
  TOOLBAR_CONTROL_SIZE,
  TOOLBAR_GAP,
  TOOLBAR_INSET,
  TOOLBAR_MUTED_FOREGROUND,
  toolbarRowStyle,
  toolbarSurfaceStyle
} from '@components/shared/toolbar-styles';
import type { DocumentSearchController } from '@types';

const INPUT_CLASS_NAME = 'captidejs-search-input';

interface SearchBarProps {
  search: DocumentSearchController;
}

const containerStyle: React.CSSProperties = {
  ...toolbarRowStyle,
  position: 'absolute',
  top: `${TOOLBAR_INSET + TOOLBAR_CONTROL_SIZE + TOOLBAR_GAP}px`,
  right: `${TOOLBAR_INSET}px`,
  zIndex: 9999,
  maxWidth: `calc(100% - ${TOOLBAR_INSET * 2}px)`
};

const fieldStyle: React.CSSProperties = {
  ...toolbarSurfaceStyle,
  minWidth: 0,
  flex: '1 1 auto',
  justifyContent: 'flex-start',
  gap: '8px',
  padding: '0 10px'
};

const inputStyle: React.CSSProperties = {
  width: '176px',
  minWidth: 0,
  flex: '1 1 auto',
  height: '100%',
  padding: 0,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: 400
};

const statusStyle: React.CSSProperties = {
  flexShrink: 0,
  minWidth: '64px',
  color: TOOLBAR_MUTED_FOREGROUND,
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
      <div style={fieldStyle}>
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
      </div>
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
