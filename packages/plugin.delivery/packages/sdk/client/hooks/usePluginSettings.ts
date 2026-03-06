import { useCallback, useEffect, useState } from 'react';

import { speraxOS } from '@/client';

export const usePluginSettings = <T>(initialValue: T) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    speraxOS.getPluginSettings().then((e) => {
      if (!e) return;

      setValue(e);
    });
  }, []);

  const updateValue = useCallback((value: T) => {
    setValue(value);
    speraxOS.setPluginSettings(value);
  }, []);

  return [value, updateValue] as const;
};
