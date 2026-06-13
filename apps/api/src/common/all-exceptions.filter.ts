import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('http');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'object' && 'message' in body
        ? (body as Record<string, unknown>).message
        : exception.message;

      this.log(status, request, String(message), status >= 500 ? exception.stack : undefined);
      response.status(status).json(body);
      return;
    }

    const message = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.log(HttpStatus.INTERNAL_SERVER_ERROR, request, message, stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal Server Error',
    });
  }

  private log(status: number, request: Request, message: string, stack?: string) {
    const entry = {
      level: status >= 500 ? 'error' : 'warn',
      method: request.method,
      path: request.path,
      status,
      message,
      ...(stack && process.env.NODE_ENV !== 'production' ? { stack } : {}),
    };

    if (status >= 500) {
      this.logger.error(JSON.stringify(entry));
    } else {
      this.logger.warn(JSON.stringify(entry));
    }
  }
}
