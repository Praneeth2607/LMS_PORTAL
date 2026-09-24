import { requestFile } from '../services/api.js';
import { useAction } from '../hooks/useUtils.js';
import Icon from './Icon.jsx';
import { Spinner } from './ui.jsx';

// Saves a file from an authenticated endpoint (the Authorization header means
// a plain link can't be used). The server names the file; `fallback` is used
// only if it doesn't.
export async function saveFile(path, fallback) {
  const { blob, filename } = await requestFile(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || fallback;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Download button (Excel/PDF) with a loading state and an inline error.
// filename: fallback name incl. extension, used only if the server sends none.
export default function DownloadButton({ path, filename, label = 'Download Excel', className = 'btn btn-secondary' }) {
  const action = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        className={className}
        disabled={action.pending}
        onClick={() => action.run(() => saveFile(path, filename))}
      >
        {action.pending ? <Spinner /> : <Icon name="download" size={18} />} {label}
      </button>
      {action.error && (
        <span role="alert" className="text-[14px] font-medium text-clay">
          {action.error.message || 'The download failed. Please try again.'}
        </span>
      )}
    </span>
  );
}
