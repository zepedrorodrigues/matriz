import { randomUUID } from 'node:crypto';
import { SYSTEM_AUTHOR_ID } from '../src/shared/events/domain-events';
import { TestApp } from './support/test-app';

/**
 * I13 — Consulta do histórico (D50, `i13-historico-analise.md` §10): RN32, SEC04, CAT04.
 */
describe('I13 — histórico', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  afterAll(async () => {
    await t.close();
  });

  describe('CAT04 / SEC04 — só de acrescento na base de dados (S1)', () => {
    let eventId: string;

    beforeAll(async () => {
      const [row] = await t.db.query(
        `INSERT INTO history.history_event (entity_type, entity_id, event_type, new_value, author_id)
         VALUES ('task', $1, 'created', '{"title":"original"}', $2) RETURNING id`,
        [randomUUID(), SYSTEM_AUTHOR_ID],
      );
      eventId = row.id;
    });

    /** Corre a instrução numa transação sempre revertida: se o privilégio voltar, nada do histórico se perde. */
    const attempt = async (sql: string, params: unknown[] = []): Promise<unknown> => {
      const runner = t.db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(sql, params);
        return null;
      } catch (error) {
        return error;
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    };

    it.each([
      ['UPDATE', `UPDATE history.history_event SET new_value = '{"title":"alterado"}' WHERE id = $1`, true],
      ['DELETE', `DELETE FROM history.history_event WHERE id = $1`, true],
      ['TRUNCATE', `TRUNCATE history.history_event`, false],
    ])('CAT04: %s como o role da aplicação falha com «permission denied»', async (_name, sql, withId) => {
      const error = await attempt(sql, withId ? [eventId] : []);
      expect(String((error as Error | null)?.message)).toMatch(/permission denied for table history_event/);
    });

    it('CAT04: o evento mantém-se e o INSERT e o SELECT continuam permitidos', async () => {
      const [row] = await t.db.query(`SELECT new_value FROM history.history_event WHERE id = $1`, [eventId]);
      expect(row.new_value).toEqual({ title: 'original' });
      expect(await attempt(`INSERT INTO history.history_event (entity_type, entity_id, event_type, author_id) VALUES ('task', $1, 'x', $2)`, [randomUUID(), SYSTEM_AUTHOR_ID])).toBeNull();
    });
  });
});
