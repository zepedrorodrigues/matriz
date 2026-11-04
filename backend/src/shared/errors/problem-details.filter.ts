import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

/** Corpo de erro RFC 9457 (openapi.yaml: Problem). */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

const TITLES: Record<number, string> = {
  400: 'Pedido inválido',
  401: 'Autenticação necessária',
  403: 'Operação não permitida',
  404: 'Recurso não encontrado',
  409: 'Conflito com o estado atual',
  422: 'Dados não processáveis',
  500: 'Erro interno',
  503: 'Serviço indisponível',
};

/** Exceção com os erros de validação por campo (apenas 400). */
export class ValidationFailedException extends HttpException {
  constructor(readonly fieldErrors: FieldError[]) {
    super('Os dados enviados não são válidos.', HttpStatus.BAD_REQUEST);
  }
}

interface HttpResponse {
  status(code: number): HttpResponse;
  setHeader(name: string, value: string): void;
  type(contentType: string): HttpResponse;
  send(body: string): void;
}

/**
 * Formato único de erro da API (architecture.md §7, DT12): *problem details* com
 * `Content-Type: application/problem+json`. Os erros inesperados respondem 500 sem detalhes internos.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<HttpResponse>();
    const req = ctx.getRequest<{ originalUrl?: string; url: string }>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!(exception instanceof HttpException)) this.logger.error(exception);

    const problem: Problem = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Erro',
      status,
      instance: req.originalUrl ?? req.url,
    };
    if (exception instanceof HttpException && status < 500) {
      const body = exception.getResponse();
      const detail = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      if (typeof detail === 'string') problem.detail = detail;
    }
    if (exception instanceof ValidationFailedException) problem.errors = exception.fieldErrors;

    // RFC 6750: o 401 indica o esquema esperado.
    if (status === HttpStatus.UNAUTHORIZED) res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(status).type('application/problem+json').send(JSON.stringify(problem));
  }
}
