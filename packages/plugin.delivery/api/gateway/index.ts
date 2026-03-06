import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async (_req: VercelRequest, response: VercelResponse) => {
  response.json({
    name: '@sperax/chat-plugins-gateway',
    status: 'ok',
  });
};
