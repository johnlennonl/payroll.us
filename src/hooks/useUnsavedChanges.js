import { useEffect, useCallback, useState } from 'react';
import { confirmDiscard } from '../lib/confirmUtils';

// Hook para gestionar cambios no guardados
export function useUnsavedChanges(initial = false) {
  const [isDirty, setIsDirty] = useState(Boolean(initial));

  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const markDirty = useCallback((v = true) => setIsDirty(Boolean(v)), []);
  const clearDirty = useCallback(() => setIsDirty(false), []);

  // Prompt programático usando SweetAlert2 (async)
  const confirmIfDirty = useCallback(async () => {
    if (!isDirty) return true;
    const ok = await confirmDiscard();
    if (ok) clearDirty();
    return ok;
  }, [isDirty, clearDirty]);

  return { isDirty, markDirty, clearDirty, confirmIfDirty };
}
