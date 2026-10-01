// "Having fun? Leave a tip." The link opens Ko-fi's tip panel in a modal.
// The panel only loads once someone opens it, so visitors who never click
// don't load anything from Ko-fi.

import { useRef, useState } from "react";

const KOFI_PAGE = "https://ko-fi.com/justincornell";
const KOFI_PANEL = "https://ko-fi.com/justincornell/?hidefeed=true&widget=true&embed=true&preview=true";

export function TipJar() {
  const dialog = useRef(null);
  const [opened, setOpened] = useState(false);

  // A plain click opens the modal; modified clicks (new tab, new window)
  // still go straight to the Ko-fi page.
  function open(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setOpened(true); // kept loaded after closing, so a half-finished tip isn't lost
    dialog.current.showModal();
  }

  function close() {
    dialog.current.close();
  }

  // The dialog element itself is only the target when the backdrop is clicked.
  function closeOnBackdrop(event) {
    if (event.target === dialog.current) close();
  }

  return (
    <>
      <p>
        Having fun? <a href={KOFI_PAGE} onClick={open}>Leave a tip</a>.
      </p>
      <dialog ref={dialog} className="tip-dialog" aria-labelledby="tip-dialog-title" onClick={closeOnBackdrop}>
        <div className="tip-dialog-body">
          <header className="tip-dialog-header">
            <h2 id="tip-dialog-title">Leave a tip</h2>
            <button type="button" className="tip-dialog-close" onClick={close} aria-label="Close">×</button>
          </header>
          {opened && (
            <iframe className="tip-frame" src={KOFI_PANEL} title="Tip justincornell on Ko-fi" height="712" />
          )}
        </div>
      </dialog>
    </>
  );
}
