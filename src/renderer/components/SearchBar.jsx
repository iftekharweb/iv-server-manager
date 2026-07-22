import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppStore.jsx';
import { terminalManager as tm } from '../lib/terminalManager.js';

export default function SearchBar() {
  const { state, actions } = useApp();
  const { activeId } = state;
  const scratchOpen = state.ui.scratchOpen;
  const { index, count } = state.ui.searchResult;
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const inp = inputRef.current;
    if (inp) { inp.focus(); inp.select(); }
    if (inp && inp.value) tm.search('next', inp.value, activeId, scratchOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = (dir, query) => {
    if (!query) {
      tm.search(dir, '', activeId, scratchOpen); // clears decorations + resets count
      return;
    }
    tm.search(dir, query, activeId, scratchOpen);
  };

  const onChange = (e) => {
    setQ(e.target.value);
    runSearch('incremental', e.target.value);
  };

  const close = () => {
    tm.clearSearch(activeId, scratchOpen);
    actions.setUi({ searchOpen: false });
    tm.focusActive(activeId);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch(e.shiftKey ? 'prev' : 'next', q);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const countLabel = count > 0 ? `${index + 1}/${count}` : count === 0 ? 'no matches' : '';

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in logs…"
        autoComplete="off"
        value={q}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <span className="search-count">{countLabel}</span>
      <button className="search-btn" title="Previous (Shift+Enter)" onClick={() => runSearch('prev', q)}>▲</button>
      <button className="search-btn" title="Next (Enter)" onClick={() => runSearch('next', q)}>▼</button>
      <button className="search-btn" title="Close (Esc)" onClick={close}>✕</button>
    </div>
  );
}
