import { useEffect, useRef, useId } from 'react';
import type { ReactNode } from 'react';
export function Dialog({title, children, onCancel}: {title:string; children:ReactNode; onCancel:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(()=>{const previous=document.activeElement;ref.current?.showModal();return()=>{ref.current?.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onCancel();}}><h2 id={titleId}>{title}</h2>{children}</dialog>;
}
