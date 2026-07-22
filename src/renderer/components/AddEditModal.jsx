import { useEffect, useState } from 'react';
import { useApp } from '../store/AppStore.jsx';
import { overlay, modal, input, select, btnGhost, btnRun } from '../ui.js';

const FIELD = 'block mb-[13px]';
const LABEL = 'block text-l-dim dark:text-d-dim mb-[5px] text-[12px]';

/** Guess a port from a run command: explicit -p/--port flag, else a trailing number. */
function detectPort(command) {
  const cmd = String(command || '');
  const flag = cmd.match(/(?:-p|--port)[=\s]+(\d{2,5})\b/i);
  const trailing = cmd.match(/\b(\d{2,5})\s*$/);
  const n = parseInt((flag && flag[1]) || (trailing && trailing[1]) || '', 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : null;
}

export default function AddEditModal() {
  const { state, actions } = useApp();
  const editing = state.ui.modal && state.ui.modal.server;
  const { shells } = state;

  const [name, setName] = useState(editing ? editing.name : '');
  const [group, setGroup] = useState(editing ? editing.group || '' : '');
  const [folder, setFolder] = useState(editing ? editing.folder : '');
  const [command, setCommand] = useState(editing ? editing.command : '');
  const [shell, setShell] = useState(editing ? editing.shell : state.config.defaultShell);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && actions.closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  const groups = [...new Set(state.config.servers.map((s) => (s.group || '').trim()).filter(Boolean))];

  const browse = async () => {
    const f = await window.api.pickFolder();
    if (f) setFolder(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    const nm = name.trim();
    const cmd = command.trim();
    if (!nm || !cmd) {
      setError('Name and command are required.');
      return;
    }
    const server = {
      id: editing ? editing.id : '',
      name: nm,
      group: group.trim(),
      folder: folder.trim(),
      command: cmd,
      shell,
    };
    // No manual Port field — auto-detect from the command so Stop/Restart can
    // still free the port PC-wide; keep an existing saved port otherwise.
    const p = detectPort(cmd);
    server.port = p ? String(p) : (editing && editing.port) || '';
    await actions.saveServer(server);
    actions.closeModal();
  };

  return (
    <div className={`${overlay} modal-overlay`} onClick={(e) => e.target.classList.contains('modal-overlay') && actions.closeModal()}>
      <div className={`${modal} w-[440px] max-w-[92vw] rounded-xl px-5 py-[18px]`}>
        <div className="text-[15px] font-semibold mb-3.5">{editing ? 'Edit Server' : 'Add Server'}</div>
        <form onSubmit={submit}>
          <label className={FIELD}>
            <span className={LABEL}>Name</span>
            <input className={input} type="text" placeholder="backend" required autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Group <small className="text-grayL dark:text-gray font-normal">(optional)</small></span>
            <input className={input} type="text" placeholder="IVTrip" autoComplete="off" list="groupList" value={group} onChange={(e) => setGroup(e.target.value)} />
            <datalist id="groupList">
              {groups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Folder</span>
            <div className="flex gap-2">
              <input className={`${input} flex-1`} type="text" placeholder="C:\path\to\project" autoComplete="off" value={folder} onChange={(e) => setFolder(e.target.value)} />
              <button type="button" className={btnGhost} onClick={browse}>Browse…</button>
            </div>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Command</span>
            <input className={input} type="text" placeholder="yarn dev" required autoComplete="off" value={command} onChange={(e) => setCommand(e.target.value)} />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Shell</span>
            <select className={`${select} w-full`} value={shell} onChange={(e) => setShell(e.target.value)}>
              {Object.keys(shells).map((sh) => (
                <option key={sh} value={sh} disabled={!shells[sh]}>
                  {shells[sh] ? sh : `${sh} (not found)`}
                </option>
              ))}
            </select>
          </label>
          <div className="text-dangerL dark:text-danger min-h-4 text-[12px] mb-1.5">{error}</div>
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" className={btnGhost} onClick={actions.closeModal}>Cancel</button>
            <button type="submit" className={btnRun}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
