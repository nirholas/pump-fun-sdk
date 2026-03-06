import { speraxOS, usePluginSettings } from '@sperax/chat-plugin-sdk/client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let getPluginSettingsSpy: any;
let setPluginSettingsSpy: any;

describe('usePluginSettings', () => {
  const initialValue = { theme: 'dark' };

  beforeEach(() => {
    // Spy on speraxOS methods and reset mocks before each test
    getPluginSettingsSpy = vi.spyOn(speraxOS, 'getPluginSettings').mockResolvedValue(undefined);
    setPluginSettingsSpy = vi.spyOn(speraxOS, 'setPluginSettings').mockResolvedValue();
  });

  afterEach(() => {
    // Reset mocks after each test
    vi.restoreAllMocks();
  });

  it('should initialize with the given initial value', () => {
    const { result } = renderHook(() => usePluginSettings(initialValue));
    const [value] = result.current;

    expect(value).toEqual(initialValue);
    expect(getPluginSettingsSpy).toHaveBeenCalledTimes(1);
  });

  it('should update state with the resolved settings', async () => {
    const newSettings = { theme: 'light' };

    getPluginSettingsSpy.mockResolvedValue(newSettings);

    const { result } = renderHook(() => usePluginSettings(initialValue));

    // Wait for state to update
    await vi.waitFor(() => expect(result.current[0]).toEqual(newSettings));
  });

  it('should not update state if resolved settings are undefined', async () => {
    const { result } = renderHook(() => usePluginSettings(initialValue));

    await vi.waitFor(() => expect(result.current[0]).toEqual(initialValue));
  });

  it('should update value and call setPluginSettings when updateValue is called', async () => {
    const { result } = renderHook(() => usePluginSettings(initialValue));
    const [, updateValue] = result.current;

    const updatedSettings = { theme: 'blue' };

    act(() => {
      updateValue(updatedSettings);
    });

    const [value] = result.current;
    expect(value).toEqual(updatedSettings);
    expect(setPluginSettingsSpy).toHaveBeenCalledWith(updatedSettings);
  });
});
