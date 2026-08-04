import { buildPublicUrl } from './links';

export function buildPayLink(token: string): string {
  return buildPublicUrl(`/pay/${token}`);
}
