import { useEffect, useState } from 'react';
import { btnRun } from '../ui.js';

const BAR =
  'flex items-center gap-2 mx-auto px-2.5 py-[3px] rounded-full text-[12px] ' +
  'border border-accentL dark:border-accent bg-l-abg dark:bg-d-abg';

// Independent widget: subscribes to auto-update status and shows a top-bar
// banner with a Restart & Update button once a download is ready.
export default function UpdateBanner() {
  const [st, setSt] = useState(null); // { status, version, percent }
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!window.api.onUpdateStatus) return undefined;
    return window.api.onUpdateStatus((payload) => setSt(payload));
  }, []);

  if (!st) return <div className="hidden" />;

  let text = '';
  let ready = false;
  switch (st.status) {
    case 'available':
      text = `Update ${st.version || ''} found — downloading…`.trim();
      break;
    case 'downloading':
      text = `Downloading update… ${st.percent || 0}%`;
      break;
    case 'downloaded':
      text = `Update ${st.version || ''} ready.`.trim();
      ready = true;
      break;
    default:
      return <div className="hidden" />;
  }

  return (
    <div className={BAR}>
      <span className="text-l-atx dark:text-d-atx whitespace-nowrap">{installing ? 'Restarting…' : text}</span>
      {ready && (
        <button
          className={btnRun}
          title="Restart and install the update"
          disabled={installing}
          onClick={() => {
            setInstalling(true);
            window.api.installUpdate();
          }}
        >
          Restart &amp; Update
        </button>
      )}
    </div>
  );
}
