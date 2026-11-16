import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function hasErrorType(error: unknown): error is { type: unknown } {
  return typeof error === 'object' && error !== null && 'type' in error;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Dados inválidos.',
      },
    });
    return;
  }
  if (hasErrorType(error) && error.type === 'entity.too.large') {
    response.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Os dados enviados excedem o tamanho permitido.',
      },
    });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
    return;
  }
  console.error('Falha interna na API:', error instanceof Error ? error.name : 'unknown');
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir. Tente novamente.' },
  });
};
