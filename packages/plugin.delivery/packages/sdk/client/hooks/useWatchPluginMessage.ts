import { useEffect, useState } from 'react';

import { PluginChannel } from '../const';
import { PluginRenderProps } from '../type';
import { onReceiveData } from '../utils';

export const useWatchPluginMessage = <T = any>() => {
  const [result, setData] = useState<{ data: T; loading: boolean }>({
    data: undefined as T,
    loading: true,
  });

  const receiverData = (e: MessageEvent) => {
    onReceiveData(e, (data: PluginRenderProps<T>) => {
      setData({ data: data.content, loading: false });
    });
  };

  useEffect(() => {
    window?.addEventListener('message', receiverData);

    top?.postMessage({ type: PluginChannel.pluginReadyForRender }, '*');

    return () => {
      window?.removeEventListener('message', receiverData);
    };
  }, []);

  return result;
};
