// Two pages don't need a routing library: this tracks the URL path and moves
// between pages with the History API, so switching balls never reloads.

import { useCallback, useEffect, useState } from "react";

export function useRoute() {
  const [path, setPath] = useState(() => location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(location.pathname);
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to) => {
    if (to === location.pathname) return;
    history.pushState(null, "", to);
    setPath(to);
  }, []);

  return [path, navigate];
}

// A plain link that navigates in-app on an ordinary click, and leaves
// modified clicks (new tab, new window) to the browser.
export function Link({ to, navigate, ...props }) {
  function onClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  }
  return <a href={to} onClick={onClick} {...props} />;
}
