import { useCallback, useRef, useState } from "react";

export interface ActiveAction {
  key: string;
  label: string;
  startedAt: number;
}

export function useActionRegistry() {
  const activeKeysRef = useRef(new Set<string>());
  const [activeActions, setActiveActions] = useState<ActiveAction[]>([]);

  const startAction = useCallback((key: string, label: string): boolean => {
    if (activeKeysRef.current.has(key)) {
      return false;
    }

    activeKeysRef.current.add(key);
    setActiveActions((current) => [...current, { key, label, startedAt: Date.now() }]);
    return true;
  }, []);

  const finishAction = useCallback((key: string) => {
    activeKeysRef.current.delete(key);
    setActiveActions((current) => current.filter((action) => action.key !== key));
  }, []);

  const isActionBusy = useCallback(
    (keyOrPrefix: string): boolean => {
      if (keyOrPrefix.endsWith(".")) {
        return activeActions.some((action) => action.key.startsWith(keyOrPrefix));
      }
      return activeKeysRef.current.has(keyOrPrefix);
    },
    [activeActions],
  );

  return {
    activeActions,
    startAction,
    finishAction,
    isActionBusy,
  };
}
