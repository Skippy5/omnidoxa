'use client';

import { useState, useEffect, useCallback } from 'react';

const PRO_STORAGE_KEY = 'omnidoxa-pro';

interface ProData {
  active: boolean;
  plan: 'monthly' | 'yearly' | null;
  subscribedAt: string | null;
  stripeSessionId: string | null;
}

const DEFAULT_PRO: ProData = {
  active: false,
  plan: null,
  subscribedAt: null,
  stripeSessionId: null,
};

export function useProStatus() {
  const [pro, setPro] = useState<ProData>(DEFAULT_PRO);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRO_STORAGE_KEY);
      if (stored) {
        setPro(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const activate = useCallback((plan: 'monthly' | 'yearly', sessionId: string) => {
    const data: ProData = {
      active: true,
      plan,
      subscribedAt: new Date().toISOString(),
      stripeSessionId: sessionId,
    };
    setPro(data);
    localStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(data));
  }, []);

  const deactivate = useCallback(() => {
    setPro(DEFAULT_PRO);
    localStorage.removeItem(PRO_STORAGE_KEY);
  }, []);

  return { isPro: pro.active, pro, loaded, activate, deactivate };
}
