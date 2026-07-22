import { useEffect, useState } from 'react';
import { useApp } from '../store/AppStore.jsx';

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
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains('modal-overlay') && actions.closeModal()}>
      <div className="modal">
        <div className="modal-head">{editing ? 'Edit Server' : 'Add Server'}</div>
        <form onSubmit={submit}>
          <label className="field">
            <span>Name</span>
            <input type="text" placeholder="backend" required autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Group <small>(optional)</small></span>
            <input type="text" placeholder="IVTrip" autoComplete="off" list="groupList" value={group} onChange={(e) => setGroup(e.target.value)} />
            <datalist id="groupList">
              {groups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </label>
          <label className="field">
            <span>Folder</span>
            <div className="folder-row">
              <input type="text" placeholder="C:\path\to\project" autoComplete="off" value={folder} onChange={(e) => setFolder(e.target.value)} />
              <button type="button" className="btn btn-ghost" onClick={browse}>Browse…</button>
            </div>
          </label>
          <label className="field">
            <span>Command</span>
            <input type="text" placeholder="yarn dev" required autoComplete="off" value={command} onChange={(e) => setCommand(e.target.value)} />
          </label>
          <label className="field">
            <span>Shell</span>
            <select className="select" value={shell} onChange={(e) => setShell(e.target.value)}>
              {Object.keys(shells).map((sh) => (
                <option key={sh} value={sh} disabled={!shells[sh]}>
                  {shells[sh] ? sh : `${sh} (not found)`}
                </option>
              ))}
            </select>
          </label>
          <div className="form-error">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={actions.closeModal}>Cancel</button>
            <button type="submit" className="btn btn-run">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
