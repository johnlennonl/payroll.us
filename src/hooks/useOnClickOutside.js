import { useEffect } from 'react';

export function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      const el = ref?.current;
      if (!el) return;
      if (el.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}
