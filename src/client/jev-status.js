// Whether Jev can answer, checked once per visit the first time a page that
// uses Jev is shown. It's assumed available until the check says otherwise,
// so the usual case never waits; a failed question also marks it unavailable.

import { useCallback, useEffect, useRef, useState } from "react";

export function useJevStatus(needed) {
  const [status, setStatus] = useState({ available: true });
  const checked = useRef(false);

  useEffect(() => {
    if (!needed || checked.current) return;
    checked.current = true;
    fetch("/api/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result?.available === false) setStatus(result);
      })
      .catch(() => {}); // can't tell; a real question will find out
  }, [needed]);

  const markUnavailable = useCallback((reason) => setStatus({ available: false, reason }), []);
  return [status, markUnavailable];
}
