import { useEffect, useState } from 'react';

// Independent widget: subscribes to auto-update status and shows a top-bar
// banner with a Restart & Update button once a download is ready.
export default function UpdateBanner() {
  const [st, setSt] = useState(null); // { status, version, percent }
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!window.api.onUpdateStatus) return undefined;
    return window.api.onUpdateStatus((payload) => setSt(payload));
  }, []);

  if (!st) return <div className="update-bar hidden" />;

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
      return <div className="update-bar hidden" />;
  }

  return (
    <div className="update-bar">
      <span className="update-text">{installing ? 'Restarting…' : text}</span>
      {ready && (
        <button
          className="btn btn-run"
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
