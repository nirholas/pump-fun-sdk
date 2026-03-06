import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export const config = {
  runtime: 'edge',
};

interface CalculateRequest {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  a: number;
  b: number;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  try {
    const { operation, a, b } = (await req.json()) as CalculateRequest;

    let result: number;
    let symbol: string;

    switch (operation) {
      case 'add':
        result = a + b;
        symbol = '+';
        break;
      case 'subtract':
        result = a - b;
        symbol = '-';
        break;
      case 'multiply':
        result = a * b;
        symbol = '×';
        break;
      case 'divide':
        if (b === 0) {
          return createErrorResponse(PluginErrorType.BadRequest, {
            message: 'Cannot divide by zero',
          });
        }
        result = a / b;
        symbol = '÷';
        break;
      default:
        return createErrorResponse(PluginErrorType.BadRequest, {
          message: 'Invalid operation',
        });
    }

    return new Response(
      JSON.stringify({
        result,
        expression: `${a} ${symbol} ${b} = ${result}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return createErrorResponse(PluginErrorType.PluginServerError, {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
