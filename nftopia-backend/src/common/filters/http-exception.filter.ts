// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  errors?: Record<string, string[]>;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: 'Error en la solicitud',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Manejo especial para errores de validación (BadRequestException)
    if (
      status === (HttpStatus.BAD_REQUEST as number) &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as { message?: string | string[] };
      if (responseObj.message && Array.isArray(responseObj.message)) {
        // Formatear errores de validación
        errorResponse.message = 'Error de validación';
        errorResponse.errors = this.formatValidationErrors(responseObj.message);
      } else if (typeof responseObj.message === 'string') {
        errorResponse.message = responseObj.message;
      }
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const responseObj = exceptionResponse as { message?: string };
      errorResponse.message = responseObj.message || exception.message;
    } else {
      errorResponse.message = exception.message;
    }

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    messages.forEach((message) => {
      // Extraer el nombre del campo del mensaje de validación
      const fieldMatch = message.match(/^(\w+)\s/);
      const field = fieldMatch ? fieldMatch[1] : 'general';

      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(message);
    });

    return errors;
  }
}
