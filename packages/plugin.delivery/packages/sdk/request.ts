/**
 * The HTTP header name for passing plugin settings.
 */
export const SPERAX_PLUGIN_SETTINGS = 'X-Sperax-Plugin-Settings';

export const getPluginSettingsFromRequest = <T = any>(req: Request): T | undefined => {
  const settings = req.headers.get(SPERAX_PLUGIN_SETTINGS);
  if (!settings) return;

  try {
    return JSON.parse(settings);
  } catch {
    return settings as any;
  }
};

export const getPluginSettingsFromHeaders = <T = any>(headers: HeadersInit): T | undefined => {
  const header = new Headers(headers as any);

  const settings = header.get(SPERAX_PLUGIN_SETTINGS);
  if (!settings) return;

  try {
    return JSON.parse(settings);
  } catch {
    return settings as any;
  }
};

export const createHeadersWithPluginSettings = (
  settings: any,
  header?: HeadersInit,
): HeadersInit => ({
  ...header,
  [SPERAX_PLUGIN_SETTINGS]: typeof settings === 'string' ? settings : JSON.stringify(settings),
});
