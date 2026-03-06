import {
  SPERAX_PLUGIN_SETTINGS,
  createHeadersWithPluginSettings,
  getPluginSettingsFromHeaders,
  getPluginSettingsFromRequest,
} from '@sperax/chat-plugin-sdk';
import { describe, expect, it } from 'vitest';

describe('getPluginSettingsFromRequest', () => {
  it('should return undefined if header is not set', () => {
    const mockRequest = new Request('https://example.com', { headers: {} });
    const settings = getPluginSettingsFromRequest(mockRequest);
    expect(settings).toBeUndefined();
  });

  it('should parse settings from Sperax header', () => {
    const mockRequest = new Request('https://example.com', {
      headers: { [SPERAX_PLUGIN_SETTINGS]: JSON.stringify({ key: 'value' }) },
    });
    const settings = getPluginSettingsFromRequest<{ key: string }>(mockRequest);
    expect(settings).toEqual({ key: 'value' });
  });

  it('should return raw string if header is not valid JSON', () => {
    const mockRequest = new Request('https://example.com', {
      headers: { [SPERAX_PLUGIN_SETTINGS]: 'not json' },
    });
    const settings = getPluginSettingsFromRequest(mockRequest);
    expect(settings).toBe('not json');
  });
});

describe('getPluginSettingsFromHeaders', () => {
  it('should return undefined if header is not set', () => {
    const settings = getPluginSettingsFromHeaders({});
    expect(settings).toBeUndefined();
  });

  it('should parse settings from Sperax header', () => {
    const settings = getPluginSettingsFromHeaders({
      [SPERAX_PLUGIN_SETTINGS]: JSON.stringify({ key: 'value' }),
    });
    expect(settings).toEqual({ key: 'value' });
  });

  it('should return raw string if header is not valid JSON', () => {
    const settings = getPluginSettingsFromHeaders({
      [SPERAX_PLUGIN_SETTINGS]: 'not json',
    });
    expect(settings).toBe('not json');
  });
});

describe('createHeadersWithPluginSettings', () => {
  it('should create headers with JSON stringified settings', () => {
    const settings = { key: 'value' };
    const headers = createHeadersWithPluginSettings(settings);
    expect(headers[SPERAX_PLUGIN_SETTINGS]).toBe(JSON.stringify(settings));
  });

  it('should create headers with string settings', () => {
    const settings = 'string setting';
    const headers = createHeadersWithPluginSettings(settings);
    expect(headers[SPERAX_PLUGIN_SETTINGS]).toBe(settings);
  });

  it('should merge provided headers with settings', () => {
    const settings = { key: 'value' };
    const customHeaders = { 'Custom-Header': 'custom' };
    const headers = createHeadersWithPluginSettings(settings, customHeaders);
    expect(headers).toEqual({
      'Custom-Header': 'custom',
      [SPERAX_PLUGIN_SETTINGS]: JSON.stringify(settings),
    });
  });
});
