import { useEffect, useRef } from "react";

// A ref that's true while the component is mounted, so a long animation can
// stop quietly if the visitor leaves the page partway through.
export function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
