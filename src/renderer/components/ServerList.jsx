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
    li.classList.add('dragging');
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
    if (li) li.classList.remove('dragging');
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
    <aside className="sidebar">
      <div className="sidebar-head">
        Servers <span className="count">{servers.length}</span>
      </div>
      <ul
        className="server-list"
        ref={listRef}
        onMouseDown={onMouseDown}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {body}
      </ul>
      <div className={'empty-hint' + (servers.length ? ' hidden' : '')}>
        No servers yet.<br />Click <b>+ Add Server</b> to create one.
      </div>
    </aside>
  );
}
