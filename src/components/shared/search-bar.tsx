import React, { useEffect, useRef } from 'react';
import ToolbarButton from '@components/shared/toolbar-button';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, SearchIcon } from '@components/shared/icons';
import {
  TOOLBAR_FIELD_MAX_WIDTH,
  TOOLBAR_FIELD_MIN_WIDTH,
  TOOLBAR_MUTED_FOREGROUND,
  toolbarSurfaceStyle
} from '@components/shared/toolbar-styles';
import useElementWidth from '@hooks/use-element-width';
import type { DocumentSearchController } from '@types';

const INPUT_CLASS_NAME = 'captidejs-search-input';

interface SearchBarProps {
  search: DocumentSearchController;
}

interface SearchBarLayout {
  compactStatus: boolean;
  showSteppers: boolean;
  showStatus: boolean;
  compactInput: boolean;
  showClose: boolean;
}

const FULL_LAYOUT: SearchBarLayout = {
  compactStatus: false,
  showSteppers: true,
  showStatus: true,
  compactInput: false,
  showClose: true
};

// Widest-first: the first step the measured bar can fit wins, so a cramped bar
// drops detail in a fixed order rather than pushing the rest of the toolbar out.
const LAYOUT_STEPS: Array<{ minWidth: number; layout: SearchBarLayout }> = [
  { minWidth: 240, layout: FULL_LAYOUT },
  { minWidth: 204, layout: { ...FULL_LAYOUT, compactStatus: true } },
  { minWidth: 140, layout: { ...FULL_LAYOUT, compactStatus: true, showSteppers: false } },
  {
    minWidth: 108,
    layout: { ...FULL_LAYOUT, compactStatus: true, showSteppers: false, showStatus: false }
  },
  {
    minWidth: 96,
    layout: {
      ...FULL_LAYOUT,
      compactStatus: true,
      showSteppers: false,
      showStatus: false,
      compactInput: true
    }
  },
  {
    minWidth: 0,
    layout: {
      compactStatus: true,
      showSteppers: false,
      showStatus: false,
      compactInput: true,
      showClose: false
    }
  }
];

const containerStyle: React.CSSProperties = {
  ...toolbarSurfaceStyle,
  flex: '1 1 auto',
  minWidth: `${TOOLBAR_FIELD_MIN_WIDTH}px`,
  maxWidth: `${TOOLBAR_FIELD_MAX_WIDTH}px`,
  justifyContent: 'flex-start',
  gap: '4px',
  padding: '0 4px 0 8px',
  overflow: 'hidden'
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

const compactInputStyle: React.CSSProperties = {
  ...inputStyle,
  minWidth: '28px',
  fontSize: '12px'
};

const statusStyle: React.CSSProperties = {
  flexShrink: 0,
  minWidth: '64px',
  color: TOOLBAR_MUTED_FOREGROUND,
  fontSize: '12px',
  fontWeight: 400,
  whiteSpace: 'nowrap',
  textAlign: 'right'
};

const compactStatusStyle: React.CSSProperties = {
  ...statusStyle,
  minWidth: '28px'
};

const separatorStyle: React.CSSProperties = {
  flexShrink: 0,
  width: '1px',
  height: '16px',
  margin: '0 2px',
  backgroundColor: '#e2e8f0'
};

const getStatusLabel = (search: DocumentSearchController, compact: boolean): string => {
  if (!search.query) return '';

  const { current, total } = search.matchesCount;
  if (total > 0) {
    return compact ? `${current}/${total}` : `${current} of ${total}`;
  }
  if (search.isPending) return compact ? '…' : 'Searching…';
  if (search.isNotFound) return compact ? '0' : 'No matches';
  return '';
};

const resolveLayout = (width: number | null): SearchBarLayout => {
  if (width === null) return FULL_LAYOUT;

  const step = LAYOUT_STEPS.find((candidate) => width >= candidate.minWidth);
  return step ? step.layout : FULL_LAYOUT;
};

const SearchBar: React.FC<SearchBarProps> = ({ search }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const width = useElementWidth(containerRef);
  const layout = resolveLayout(width);
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
    <div ref={containerRef} style={containerStyle}>
      <style>{`.${INPUT_CLASS_NAME}::placeholder { color: #94a3b8; }`}</style>
      <span style={iconStyle} aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        className={INPUT_CLASS_NAME}
        style={layout.compactInput ? compactInputStyle : inputStyle}
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document"
        aria-label="Find in document"
      />
      {layout.showStatus && (
        <span style={layout.compactStatus ? compactStatusStyle : statusStyle}>
          {getStatusLabel(search, layout.compactStatus)}
        </span>
      )}
      {layout.showSteppers && (
        <>
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
        </>
      )}
      {layout.showSteppers && layout.showClose && <span style={separatorStyle} />}
      {layout.showClose && (
        <ToolbarButton variant="ghost" onClick={search.close} title="Close find bar">
          <CloseIcon />
        </ToolbarButton>
      )}
    </div>
  );
};

export default SearchBar;
