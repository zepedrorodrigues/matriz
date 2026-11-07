import { DatePicker } from './date-picker';

/**
 * Campo de data com a mesma estrutura do FormField: etiqueta, ajuda e erro associados (Ex. 7). Mostra e
 * escolhe a data em pt-PT (DD/MM/AAAA, semana à segunda, RNF10), qualquer que seja o idioma do browser
 * (DT17); quando não é obrigatório, «Sem data» apaga-a. O valor continua a ser AAAA-MM-DD.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return <DatePicker label={label} value={value} onChange={onChange} error={error} hint={hint} required={required} />;
}
