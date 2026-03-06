import { PluginChannel } from './const';
import { PluginRenderProps } from './type';

export const onReceiveData = <T>(e: MessageEvent, onData: (data: PluginRenderProps<T>) => void) => {
  if (e.data.type === PluginChannel.renderPlugin) {
    const props = e.data.props as PluginRenderProps<T>;
    onData(props);
  }
};
