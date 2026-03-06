import {
  PluginErrorType,
  createErrorResponse,
  getPluginErrorStatus,
} from '@sperax/chat-plugin-sdk';
import { describe, expect, it } from 'vitest';

describe('getPluginErrorStatus', () => {
  it('should return 404 for not found errors', () => {
    expect(getPluginErrorStatus(PluginErrorType.PluginApiNotFound)).toBe(404);
    expect(getPluginErrorStatus(PluginErrorType.PluginMetaNotFound)).toBe(404);
    expect(getPluginErrorStatus(PluginErrorType.PluginManifestNotFound)).toBe(404);
  });

  it('should return 490 for invalid plugin-related errors', () => {
    expect(getPluginErrorStatus(PluginErrorType.PluginMetaInvalid)).toBe(490);
    expect(getPluginErrorStatus(PluginErrorType.PluginMarketIndexInvalid)).toBe(490);
    expect(getPluginErrorStatus(PluginErrorType.PluginManifestInvalid)).toBe(490);
  });

  it('should return 590 for PluginMarketIndexNotFound', () => {
    expect(getPluginErrorStatus(PluginErrorType.PluginMarketIndexNotFound)).toBe(590);
  });

  it('should return 422 for user input related errors', () => {
    expect(getPluginErrorStatus(PluginErrorType.PluginApiParamsError)).toBe(422);
    expect(getPluginErrorStatus(PluginErrorType.PluginSettingsInvalid)).toBe(422);
  });

  it('should return the errorType itself if it is a number', () => {
    expect(getPluginErrorStatus(400)).toBe(400);
    expect(getPluginErrorStatus(500)).toBe(500);
  });

  it('should return 500 for unknown error types', () => {
    expect(getPluginErrorStatus('SomeUnknownError')).toBe(500);
  });
});

describe('createErrorResponse', () => {
  it('should create an error response with the correct status and body', async () => {
    const errorType = PluginErrorType.PluginApiNotFound;
    const body = { message: 'Plugin API not found' };
    const response = createErrorResponse(errorType, body);
    expect(response.status).toBe(404);
    expect(await response.text()).toEqual(JSON.stringify({ body, errorType }));
  });

  it('should handle string error types and use default 500 status', async () => {
    const errorType = 'UnknownError';
    const body = { message: 'An unknown error occurred' };
    const response = createErrorResponse(errorType, body);
    expect(response.status).toBe(500);
    expect(await response.text()).toEqual(JSON.stringify({ body, errorType }));
  });

  it('should handle numeric error types and use the number as status', async () => {
    const errorType = 400;
    const body = { message: 'Bad request' };
    const response = createErrorResponse(errorType, body);
    expect(response.status).toBe(errorType);
    expect(await response.text()).toEqual(JSON.stringify({ body, errorType: 400 }));
  });
});
