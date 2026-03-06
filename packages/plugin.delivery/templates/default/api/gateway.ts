import { createSperaxPluginGateway } from '@sperax/chat-plugins-gateway';

export const config = {
  runtime: 'edge',
};

// The gateway handles routing requests to your plugin APIs
// This is only needed for local development
// In production, requests go directly to your API endpoints
export default createSperaxPluginGateway();
