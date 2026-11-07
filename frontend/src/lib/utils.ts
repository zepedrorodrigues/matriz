import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind, resolvendo conflitos (a última ganha). Usado pelos componentes do shadcn/ui. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
