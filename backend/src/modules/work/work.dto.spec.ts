// Os decoradores do DTO usam metadados; a aplicação carrega este polyfill no arranque (NestJS).
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto, UpdateTaskDto } from './work.dto';

/**
 * Ficha PL 04, Ex. 2 — testes unitários da regra do título e da descrição da tarefa (RN42, CA03.18), sem
 * base de dados nem servidor: a validação é a do DTO, a mesma que a API aplica a cada pedido (ValidationPipe).
 * Regra (requirements.md RN42): título obrigatório, de 3 a 150 caracteres, sem contar os espaços no início e
 * no fim, e não pode ser só espaços; descrição até 2000. Executar: npm run test:unit -w backend.
 */
const TITLE_MESSAGE = 'O título tem de ter entre 3 e 150 caracteres, sem contar os espaços no início e no fim.';

/** Mensagens de erro de um campo, depois das transformações do DTO (p. ex. retirar os espaços). */
async function errorsOf<T extends object>(cls: new () => T, input: object, field: string): Promise<string[]> {
  const dto = plainToInstance(cls, input);
  const errors = await validate(dto);
  return errors.filter((e) => e.property === field).flatMap((e) => Object.values(e.constraints ?? {}));
}
const titleErrors = (title: unknown) => errorsOf(CreateTaskDto, { title }, 'title');

describe('RN42, CA03.18 — título da tarefa (CreateTaskDto)', () => {
  describe('casos válidos', () => {
    it('um título normal é aceite', async () => {
      expect(await titleErrors('Exportar relatório mensal')).toEqual([]);
    });

    it('os espaços no início e no fim são retirados antes de validar e não ficam guardados', async () => {
      const dto = plainToInstance(CreateTaskDto, { title: '   Rever contrato   ' });
      expect(dto.title).toBe('Rever contrato');
      expect(await titleErrors('   Rever contrato   ')).toEqual([]);
    });

    it('os espaços no meio contam e são mantidos', async () => {
      const dto = plainToInstance(CreateTaskDto, { title: 'a  b' });
      expect(dto.title).toBe('a  b');
      expect(await titleErrors('a  b')).toEqual([]);
    });
  });

  describe('valores-limite', () => {
    it.each([
      ['3 caracteres (mínimo)', 'abc'],
      ['150 caracteres (máximo)', 'x'.repeat(150)],
      ['3 caracteres depois de retirar os espaços', '  abc  '],
      ['150 caracteres depois de retirar os espaços', `  ${'x'.repeat(150)}  `],
    ])('%s → aceite', async (_label, title) => {
      expect(await titleErrors(title)).toEqual([]);
    });

    it.each([
      ['2 caracteres (abaixo do mínimo)', 'ab'],
      ['151 caracteres (acima do máximo)', 'x'.repeat(151)],
      ['2 caracteres depois de retirar os espaços', '  ab  '],
    ])('%s → recusado com a mensagem da regra', async (_label, title) => {
      expect(await titleErrors(title)).toContain(TITLE_MESSAGE);
    });
  });

  describe('casos inválidos', () => {
    it.each([
      ['vazio', ''],
      ['só com espaços', '     '],
      ['só com espaços e tabulações', ' \t \n '],
      ['número em vez de texto', 123],
      ['null', null],
    ])('título %s → recusado', async (_label, title) => {
      expect((await titleErrors(title)).length).toBeGreaterThan(0);
    });

    it('sem título → recusado (o título é obrigatório)', async () => {
      expect((await errorsOf(CreateTaskDto, {}, 'title')).length).toBeGreaterThan(0);
    });
  });
});

describe('CA03.18 — descrição da tarefa (CreateTaskDto)', () => {
  const descriptionErrors = (description: unknown) => errorsOf(CreateTaskDto, { title: 'Título válido', description }, 'description');

  it('2000 caracteres → aceite; 2001 → recusado', async () => {
    expect(await descriptionErrors('d'.repeat(2000))).toEqual([]);
    expect((await descriptionErrors('d'.repeat(2001))).length).toBeGreaterThan(0);
  });

  it('a descrição é opcional', async () => {
    expect(await errorsOf(CreateTaskDto, { title: 'Título válido' }, 'description')).toEqual([]);
  });
});

describe('CA03.18 — título na edição (UpdateTaskDto)', () => {
  const updateTitleErrors = (input: object) => errorsOf(UpdateTaskDto, input, 'title');

  it('sem título no pedido, o título não é validado (só se alteram os campos enviados)', async () => {
    expect(await updateTitleErrors({ priority: 'high' })).toEqual([]);
  });

  it('título enviado só com espaços ou com 151 caracteres → recusado; com 150 → aceite', async () => {
    expect(await updateTitleErrors({ title: '   ' })).toContain(TITLE_MESSAGE);
    expect(await updateTitleErrors({ title: 'x'.repeat(151) })).toContain(TITLE_MESSAGE);
    expect(await updateTitleErrors({ title: 'x'.repeat(150) })).toEqual([]);
  });
});
