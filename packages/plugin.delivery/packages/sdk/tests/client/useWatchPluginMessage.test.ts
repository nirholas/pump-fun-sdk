import {
  PluginChannel,
  PluginRenderProps,
  useWatchPluginMessage,
} from '@sperax/chat-plugin-sdk/client';
import { act, renderHook } from '@testing-library/react';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useWatchPluginMessage', () => {
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  const originalPostMessage = window.postMessage;

  beforeEach(() => {
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
    window.postMessage = vi.fn();
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    window.postMessage = originalPostMessage;
  });

  it('should register and unregister message event listener', () => {
    const { unmount } = renderHook(() => useWatchPluginMessage());

    expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('should send pluginReadyForRender message on mount', () => {
    renderHook(() => useWatchPluginMessage());

    expect(window.postMessage).toHaveBeenCalledWith(
      { type: PluginChannel.pluginReadyForRender },
      '*',
    );
  });

  it('should update state when receiving valid plugin message', () => {
    const { result } = renderHook(() => useWatchPluginMessage());

    const mockData = {
      content: 'test-content',
    } as PluginRenderProps;

    // Create a MessageEvent with the expected structure
    const messageEvent = new MessageEvent('message', {
      data: {
        props: mockData,
        type: PluginChannel.renderPlugin,
      },
    });

    // Simulate the message event being dispatched
    act(() => {
      // Call the event listener directly with the message event
      const eventListener = (window.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === 'message',
      )[1];
      eventListener(messageEvent);
    });

    // Verify the state has been updated
    expect(result.current.data).toBe(mockData.content);
    expect(result.current.loading).toBe(false);
  });
});
