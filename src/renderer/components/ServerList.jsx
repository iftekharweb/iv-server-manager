import { useRef } from 'react';
import { useApp } from '../store/AppStore.jsx';
import ServerItem from './ServerItem.jsx';
import GroupHeader from './GroupHeader.jsx';

function getDragAfterElement(listEl, y) {
  const items = [...listEl.querySelectorAll('.server-item:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of items) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

export default function ServerList() {
  const { state, actions } = useApp();
  const { servers } = state.config;
  const listRef = useRef(null);

  // Drag-to-reorder via event delegation on the <ul>. The transient DOM shuffle
  // is visual only; on dragend we read the resulting id order and dispatch a
  // reorder — the state-driven re-render is the source of truth.
  const onMouseDown = (e) => {
    const li = e.target.closest('.server-item');
    if (li) li.draggable = !e.target.closest('.mini');
  };
  const onDragStart = (e) => {
    const li = e.target.closest('.server-item');
    if (!li) return;
    li.classList.add('dragging', 'opacity-40');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    const list = listRef.current;
    const dragging = list && list.querySelector('.dragging');
    if (!dragging) return;
    const after = getDragAfterElement(list, e.clientY);
    if (after == null) list.appendChild(dragging);
    else list.insertBefore(dragging, after);
  };
  const onDragEnd = (e) => {
    const li = e.target.closest('.server-item');
    if (li) li.classList.remove('dragging', 'opacity-40');
    const ids = [...listRef.current.querySelectorAll('.server-item')].map((n) => n.dataset.id);
    const current = servers.map((s) => s.id);
    if (ids.join() !== current.join()) actions.reorder(ids);
  };

  const hasGroups = servers.some((s) => (s.group || '').trim() !== '');

  let body;
  if (!hasGroups) {
    body = servers.map((s) => <ServerItem key={s.id} server={s} />);
  } else {
    const order = [];
    servers.forEach((s) => {
      const g = (s.group || '').trim();
      if (!order.includes(g)) order.push(g);
    });
    order.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : 0));
    body = order.flatMap((g) => {
      const inGroup = servers.filter((s) => (s.group || '').trim() === g);
      const rows = [<GroupHeader key={`g:${g}`} name={g} servers={inGroup} />];
      if (!state.ui.collapsedGroups.includes(g)) {
        inGroup.forEach((s) => rows.push(<ServerItem key={s.id} server={s} />));
      }
      return rows;
    });
  }

  return (
    <aside className="w-[260px] flex-none flex flex-col min-h-0 bg-l-bg2 dark:bg-d-bg2 border-r border-l-bd dark:border-d-bd">
      <div className="px-3.5 py-2.5 text-[11px] tracking-[0.06em] uppercase text-l-dim dark:text-d-dim border-b border-l-bd dark:border-d-bd flex items-center gap-2">
        Servers <span className="bg-l-bg3 dark:bg-d-bg3 rounded-[10px] px-[7px] py-px text-[11px]">{servers.length}</span>
      </div>
      <ul
        className="list-none m-0 p-1.5 overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={listRef}
        onMouseDown={onMouseDown}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {body}
      </ul>
      <div className={'px-4 py-6 text-l-dim dark:text-d-dim text-center leading-relaxed' + (servers.length ? ' hidden' : '')}>
        No servers yet.<br />Click <b>+ Add Server</b> to create one.
      </div>
    </aside>
  );
}
