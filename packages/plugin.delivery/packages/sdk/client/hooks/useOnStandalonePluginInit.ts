import { useEffect } from 'react';

import { PluginPayload, speraxOS } from '@/client';

export const useOnStandalonePluginInit = <T = any>(
  callback: (payload: PluginPayload<T>) => void,
) => {
  useEffect(() => {
    speraxOS.getPluginPayload().then((e) => {
      if (!e) return;

      callback(e);
    });
  }, []);
};
