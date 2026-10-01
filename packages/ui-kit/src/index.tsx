import type { ReactNode } from 'react';
export function Status({children, error = false}: {children: ReactNode; error?: boolean}) {
  return <p className={error ? 'status error' : 'status'} role={error ? 'alert' : 'status'}>{children}</p>;
}
export function EmptyState({title, children}: {title: string; children: ReactNode}) {
  return <section className="empty-state"><h2>{title}</h2>{children}</section>;
}
export const themeTokens = Object.freeze({ spacing: [4, 8, 12, 16, 24, 32], target: 48, radius: 12 });
