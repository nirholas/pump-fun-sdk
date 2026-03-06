import { PluginChannel } from '@/client/const';
import { PluginRenderProps } from '@/client/type';
import { PluginRequestPayload } from '@/schema/market';

/**
 * Represents a plugin payload.
 *
 * @template T - Type of the arguments.
 * @property {T} [arguments] - The arguments for the plugin.
 * @property {string} name - The name of the api payload
 * @property {any} settings - The settings for the plugin.
 * @property {any} [state] - The state of the current plugin message
 */
export interface PluginPayload<T = any> {
  arguments?: T;
  name: string;
  settings?: any;
  state?: any;
}

class SperaxOS {
  getPluginPayload = <T = any>() =>
    new Promise<PluginPayload<T>>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(undefined as any);
        return;
      }

      const timer = setTimeout(() => {
        resolve(undefined as any);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        window.removeEventListener('message', receiverData);
      }, 1000);

      const receiverData = (e: MessageEvent) => {
        if (e.data.type === PluginChannel.initStandalonePlugin) {
          // TODO: drop e.data.props in v2
          const payload: PluginRequestPayload = e.data.payload || e.data.props;
          const func = payload.apiName;
          const args = JSON.parse(payload.arguments || '{}');
          clearTimeout(timer);

          resolve({
            arguments: args,
            name: func,
            settings: e.data.settings,
            state: e.data.state,
          });

          window.removeEventListener('message', receiverData);
        }
      };

      window.addEventListener('message', receiverData);

      top?.postMessage({ type: PluginChannel.pluginReadyForRender }, '*');
    });

  getPluginSettings = <T = any>() =>
    new Promise<T>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(undefined as any);
        return;
      }

      const receiverData = (e: MessageEvent) => {
        if (e.data.type === PluginChannel.renderPluginSettings) {
          resolve(e.data.value);

          window.removeEventListener('message', receiverData);
        }
      };

      window.addEventListener('message', receiverData);

      top?.postMessage({ type: PluginChannel.fetchPluginSettings }, '*');
    });

  setPluginSettings = (settings: any) => {
    top?.postMessage({ type: PluginChannel.updatePluginSettings, value: settings }, '*');
  };

  getPluginMessage = <T = any>() =>
    new Promise<T>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(undefined as any);
        return;
      }
      const receiverData = (e: MessageEvent) => {
        if (e.data.type === PluginChannel.renderPlugin) {
          const props = e.data.props as PluginRenderProps<T>;
          resolve(props.content as T);

          window.removeEventListener('message', receiverData);
        }
      };

      window.addEventListener('message', receiverData);

      top?.postMessage({ type: PluginChannel.fetchPluginMessage }, '*');
    });

  setPluginMessage = (content: any, triggerAiMessage?: boolean) => {
    top?.postMessage(
      { content, triggerAiMessage, type: PluginChannel.fillStandalonePluginContent },
      '*',
    );
  };

  getPluginState = <T = any>(key: string) =>
    new Promise<T>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(undefined as any);
        return;
      }

      const receiverData = (e: MessageEvent) => {
        if (e.data.type === PluginChannel.renderPluginState && e.data.key === key) {
          resolve(e.data.value);

          window.removeEventListener('message', receiverData);
        }
      };

      window.addEventListener('message', receiverData);

      top?.postMessage({ key, type: PluginChannel.fetchPluginState }, '*');
    });
  setPluginState = (key: string, value: any) => {
    top?.postMessage({ key, type: PluginChannel.updatePluginState, value }, '*');
  };

  triggerAIMessage = (id: string) => {
    top?.postMessage({ id, type: PluginChannel.triggerAIMessage }, '*');
  };

  createAssistantMessage = (content: string) => {
    top?.postMessage({ content, type: PluginChannel.createAssistantMessage }, '*');
  };
}

export const speraxOS = new SperaxOS();
