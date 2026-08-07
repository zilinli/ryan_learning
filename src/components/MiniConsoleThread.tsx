"use client";
import { useMemo } from "react";
import type { ConsoleMessage } from "@/lib/types";
type Props={messages:ConsoleMessage[];streaming?:boolean};
export function MiniConsoleThread({messages,streaming}:Props){
  const v=useMemo(()=>messages.slice(-5),[messages]);
  if(v.length===0&&!streaming)return <div className="flex flex-col items-center gap-2 px-3 py-8 text-center"><span className="text-2xl">🛠</span><p className="text-xs font-medium text-[var(--ink)]">Tell Spark how to improve</p></div>;
  return <div className="flex flex-col gap-2 px-2 py-3">{v.map(m=><B key={m.id} m={m}/>)}{streaming?<div className="flex items-center gap-2 px-3 py-2"><div className="flex gap-1">{[0,150,300].map((d,i)=><div key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--teal)]" style={{animationDelay:d+"ms"}}/>)}</div><span className="text-[11px] text-[var(--ink-muted)]">Working…</span></div>:null}</div>;
}
function B({m}:{m:ConsoleMessage}){if(m.role==="system")return <div className="rounded-lg bg-[var(--mist)]/50 px-3 py-1.5 text-center text-[11px] text-[var(--ink-muted)]">{m.content}</div>;const u=m.role==="user";return <div className={"flex flex-col gap-0.5"+(u?" items-end":" items-start")}><span className="text-[10px] font-medium text-[var(--ink-muted)]">{u?"You":"🛠 Builder"}</span><div className={"max-w-full rounded-xl px-3 py-2 text-sm"+(u?" bg-[var(--teal)]/10":" bg-[var(--mist)]")}>{m.attachments&&m.attachments.length>0?<div className="mb-1.5 flex flex-wrap gap-1">{m.attachments.map((a,i)=><span key={`${a.name}-${i}`} className="inline-flex max-w-[140px] items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-[var(--ink-muted)]">{a.kind==="image"?"🖼":"📄"}<span className="truncate">{a.name}</span></span>)}</div>:null}<p className="whitespace-pre-wrap break-words text-xs">{m.content.length>500?m.content.slice(0,500)+"…":m.content}</p></div></div>}
