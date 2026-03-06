export enum PluginChannel {
  createAssistantMessage = 'speraxos:create-assistant-message',

  fetchPluginMessage = 'speraxos:fetch-plugin-message',
  fetchPluginSettings = 'speraxos:fetch-plugin-settings',

  fetchPluginState = 'speraxos:fetch-plugin-state',
  fillStandalonePluginContent = 'speraxos:fill-plugin-content',
  initStandalonePlugin = 'speraxos:init-standalone-plugin',

  pluginReadyForRender = 'speraxos:plugin-ready-for-render',

  renderPlugin = 'speraxos:render-plugin',
  renderPluginSettings = 'speraxos:render-plugin-settings',
  renderPluginState = 'speraxos:render-plugin-state',

  triggerAIMessage = 'speraxos:trigger-ai-message',

  updatePluginSettings = 'speraxos:update-plugin-settings',
  updatePluginState = 'speraxos:update-plugin-state',
}
