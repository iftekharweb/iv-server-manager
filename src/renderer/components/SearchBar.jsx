import { useEffect, useRef, useState } from 'react';
import { FiChevronUp, FiChevronDown, FiX } from 'react-icons/fi';
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
  const sbtn =
    'inline-flex items-center justify-center bg-l-bg3 dark:bg-d-bg3 border border-l-bd dark:border-d-bd ' +
    'text-l-tx dark:text-d-tx rounded-[5px] px-2 py-1 cursor-pointer text-[12px] hover:bg-l-hv dark:hover:bg-d-hv';

  return (
    <div className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-lg px-1.5 py-[5px] bg-l-bg2 dark:bg-d-bg2 border border-l-bd dark:border-d-bd shadow-[0_6px_20px_rgba(0,0,0,0.4)]">
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in logs…"
        autoComplete="off"
        value={q}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="bg-l-bg3 dark:bg-d-bg3 border border-l-bd dark:border-d-bd text-l-tx dark:text-d-tx rounded-[5px] px-2 py-[5px] text-[12.5px] w-[200px] outline-none focus:border-accentL dark:focus:border-accent select-text"
      />
      <span className="text-l-dim dark:text-d-dim text-[11px] min-w-[52px] text-center">{countLabel}</span>
      <button className={sbtn} title="Previous (Shift+Enter)" onClick={() => runSearch('prev', q)}><FiChevronUp /></button>
      <button className={sbtn} title="Next (Enter)" onClick={() => runSearch('next', q)}><FiChevronDown /></button>
      <button className={sbtn} title="Close (Esc)" onClick={close}><FiX /></button>
    </div>
  );
}
