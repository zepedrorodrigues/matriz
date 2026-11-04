import { ValidationError, ValidationPipe } from '@nestjs/common';
import { FieldError, ValidationFailedException } from './problem-details.filter';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/**
 * Validação na fronteira da API (architecture.md §7): rejeita propriedades desconhecidas
 * (o contrato usa `additionalProperties: false`) e devolve os erros por campo em `errors`.
 */
export const apiValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new ValidationFailedException(flatten(errors)),
  });
