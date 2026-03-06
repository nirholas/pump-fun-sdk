import { speraxOS, usePluginState } from '@sperax/chat-plugin-sdk/client';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('usePluginState', () => {
  const key = 'testKey';
  const initialValue = 'initialValue';

  let getPluginStateSpy: any;
  let setPluginStateSpy: any;

  beforeEach(() => {
    // Mock speraxOS methods before each test
    getPluginStateSpy = vi.spyOn(speraxOS, 'getPluginState').mockResolvedValue(undefined);
    setPluginStateSpy = vi.spyOn(speraxOS, 'setPluginState').mockResolvedValue();
  });

  afterEach(() => {
    // Restore mocks after each test
    vi.restoreAllMocks();
  });

  it('should initialize with the given initial value', () => {
    const { result } = renderHook(() => usePluginState(key, initialValue));
    const [value] = result.current;

    expect(value).toBe(initialValue);
    expect(getPluginStateSpy).toHaveBeenCalledWith(key);
  });

  it('should update state with the resolved plugin state', async () => {
    const resolvedState = 'resolvedState';
    getPluginStateSpy.mockResolvedValue(resolvedState);

    const { result } = renderHook(() => usePluginState(key, initialValue));

    // Wait for state to update
    await vi.waitFor(() => expect(result.current[0]).toBe(resolvedState));
  });

  it('should not update state if resolved plugin state is undefined', async () => {
    const { result } = renderHook(() => usePluginState(key, initialValue));

    await vi.waitFor(() => expect(result.current[0]).toBe(initialValue));
  });

  it('should update value and call setPluginState when updateValue is called', async () => {
    const { result } = renderHook(() => usePluginState(key, initialValue));
    const [, updateValue] = result.current;

    const newValue = 'newValue';

    act(() => {
      updateValue(newValue);
    });

    expect(result.current[0]).toBe(newValue);
    expect(setPluginStateSpy).toHaveBeenCalledWith(key, newValue);
  });
});
