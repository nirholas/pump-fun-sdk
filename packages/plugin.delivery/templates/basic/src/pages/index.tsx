import { speraxOS } from '@sperax/plugin-sdk/client';
import { memo, useEffect, useState } from 'react';

import Data from '@/components/Render';
import { ResponseData } from '@/type';

const Render = memo(() => {
  const [data, setData] = useState<ResponseData>();

  useEffect(() => {
    speraxOS.getPluginMessage().then((e: ResponseData) => {
      setData(e);
    });
  }, []);

  return <Data {...data}></Data>;
});

export default Render;
