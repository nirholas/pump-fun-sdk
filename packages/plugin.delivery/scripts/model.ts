import { ChatOpenAI } from '@langchain/openai';

import { config } from './const';

export const model = new ChatOpenAI({
  configuration: { baseURL: process.env.OPENAI_PROXY_URL },
  maxRetries: 4,
  model: config.modelName,
  temperature: config.temperature,
});
