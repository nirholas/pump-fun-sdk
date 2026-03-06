import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, response: VercelResponse) => {
  response.json({
    status: 'ok',
  });
  return 'hello';
};
