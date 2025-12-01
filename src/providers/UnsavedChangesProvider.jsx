import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { confirmDiscard } from '../lib/confirmUtils';

const UnsavedCtx = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const [isDirty, setIsDirty] = useState(false);

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

  const confirmIfDirty = useCallback(async () => {
    if (!isDirty) return true;
    const ok = await confirmDiscard();
    if (ok) clearDirty();
    return ok;
  }, [isDirty, clearDirty]);

  const value = { isDirty, markDirty, clearDirty, confirmIfDirty };
  return <UnsavedCtx.Provider value={value}>{children}</UnsavedCtx.Provider>;
}

export function useUnsavedContext() {
  const ctx = useContext(UnsavedCtx);
  if (!ctx) throw new Error('useUnsavedContext must be used inside UnsavedChangesProvider');
  return ctx;
}
