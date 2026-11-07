import { useEffect, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, addComment, listComments } from '../../api/client';
import { FormField } from '../../components/FormField';
import { Notice } from '../../components/Notice';
import { Pagination } from '../../components/Pagination';
import { lastPage, validateCommentText } from '../../domain/tasks';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 20;
const dateTime = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Não foi possível guardar o comentário. Tente novamente.');

interface CommentsPanelProps {
  taskId: string;
  /** Ao começar uma operação daqui, o ecrã apaga o resultado das suas (Ex. 8, caso 09). */
  onOperationStart: () => void;
  /** Muda quando começa uma operação noutra parte do ecrã: apaga o resultado deste painel. */
  resetKey: number;
}

/**
 * Comentários da tarefa (US10; CA10.1–CA10.5; RN41; Ficha PL 03, Ex. 6): por ordem cronológica, com o
 * autor e a data/hora definidos pelo backend. Quem vê a tarefa vê o projeto e pode comentar (CAT06).
 * O texto escrito mantém-se quando o pedido falha e não há submissões repetidas.
 */
export function CommentsPanel({ taskId, onOperationStart, resetKey }: CommentsPanelProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const comments = useQuery({
    queryKey: ['comments', taskId, page],
    queryFn: () => listComments(taskId, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const add = useMutation({
    mutationFn: (body: string) => addComment(taskId, body),
    onMutate: () => {
      onOperationStart();
      setSuccess(undefined);
    },
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      // O comentário novo é o último por ordem cronológica: mostra-se a página onde ficou.
      const total = (comments.data?.total ?? 0) + 1;
      setPage(lastPage(total, PAGE_SIZE));
      setSuccess('Comentário publicado.');
    },
  });

  useEffect(() => {
    setSuccess(undefined);
    add.reset();
  }, [resetKey]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (add.isPending) return;
    const error = validateCommentText(draft);
    setDraftError(error);
    if (!error) add.mutate(draft.trim());
  };

  const serverFieldError = add.error instanceof ApiError && add.error.status === 400 ? add.error.fieldErrors().body : undefined;
  const generalError = add.error && !serverFieldError ? errorText(add.error) : undefined;
  const data = comments.data;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="comments-title">
      <h2 id="comments-title" className="m-0 text-sm font-semibold">Comentários{data ? ` (${data.total})` : ''}</h2>
      {success ? <Notice tone="success">{success}</Notice> : null}

      {comments.isError ? (
        <Notice tone="error">Não foi possível carregar os comentários. Tente novamente mais tarde.</Notice>
      ) : !data ? (
        <Notice>A carregar os comentários…</Notice>
      ) : data.total === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Ainda não há comentários.</p>
      ) : (
        <>
          <ol className="m-0 flex list-none flex-col p-0" aria-label="Comentários por ordem cronológica">
            {data.items.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 border-b py-2.5 last:border-b-0">
                <span className="text-xs text-muted-foreground">
                  <strong>{c.author.name}</strong> · <time dateTime={c.createdAt}>{dateTime.format(new Date(c.createdAt))}</time>
                </span>
                <span className="m-0 whitespace-pre-line text-sm">{c.body}</span>
              </li>
            ))}
          </ol>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}

      <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
        {generalError ? <Notice tone="error">{generalError}</Notice> : null}
        <FormField
          label="Novo comentário"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setDraftError(undefined);
          }}
          error={draftError ?? serverFieldError}
          maxLength={2000}
          hint="Descreva o trabalho, nunca motivos pessoais"
          multiline
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? 'A publicar…' : 'Publicar comentário'}
          </Button>
        </div>
      </form>
    </section>
  );
}
