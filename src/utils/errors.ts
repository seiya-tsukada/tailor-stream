/** catch した値からメッセージを取り出す。取り出せない・空の場合は fallback を返す */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}
