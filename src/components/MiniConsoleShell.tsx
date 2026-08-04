"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MiniDiffViewer } from "./MiniDiffViewer";
import { MiniConsoleThread } from "./MiniConsoleThread";
import { ConsoleComposer, type ComposerSubmit } from "./ConsoleComposer";
import { PinGate } from "./PinGate";
import { getConsoleSessionId } from "@/lib/mini-console-store";
import type { ClientAttachment } from "@/lib/file-payload";
import type { ConsoleMessage, DiffBlock } from "@/lib/types";
type Props={open:boolean;onClose:()=>void;onOpenFullConsole?:()=>void};
export function MiniConsoleShell({open,onClose,onOpenFullConsole}:Props){
  const[phase,setPhase]=useState<"idle"|"thinking"|"diff"|"applied"|"error">("idle");
  const[msgs,setMsgs]=useState<ConsoleMessage[]>([]);
  const[err,setError]=useState("");
  const[showPin,setShowPin]=useState(false);
  const[diff,setDiff]=useState<DiffBlock|null>(null);
  const sid=useRef(getConsoleSessionId());
  const ab=useRef<AbortController|null>(null);
  useEffect(()=>{if(!open)return;const k=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[open,onClose]);
  const send=useCallback(async({text,attachments,voiceLang}:ComposerSubmit)=>{
    setPhase("thinking");setError("");setDiff(null);
    setMsgs(p=>[...p,{id:"cm_"+Date.now(),role:"user",content:text,attachments:attachments.map((a:ClientAttachment)=>({name:a.name,kind:a.kind})),createdAt:Date.now()}]);
    const c=new AbortController();ab.current=c;
    try{
      const res=await fetch("/api/console/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid.current,message:text,voiceLang,attachments:attachments.map((a:ClientAttachment)=>({name:a.name,mimeType:a.mimeType,kind:a.kind,data:a.data,dataUrl:a.dataUrl,textContent:a.textContent}))}),signal:c.signal});
      if(!res.ok)throw new Error(((await res.json().catch(()=>({}))) as {error?:string}).error||"Error "+res.status);
      let full="";const r=res.body!.getReader();const d=new TextDecoder();let buf="";
      while(true){const{done,value}=await r.read();if(done)break;buf+=d.decode(value,{stream:true});const parts=buf.split("\n\n");buf=parts.pop()??"";for(const p of parts){const ls=p.split("\n");let ev="message",dl="";for(const l of ls){if(l.startsWith("event:"))ev=l.slice(6).trim();if(l.startsWith("data:"))dl+=l.slice(5).trim()}if(!dl)continue;try{const data=JSON.parse(dl) as {text?:string;error?:string};if(ev==="delta"&&data.text)full+=data.text;if(ev==="error"&&data.error)throw new Error(data.error);if(ev==="done")full=data.text||full}catch(e){if(e instanceof SyntaxError)continue;throw e}}}
      const hasDiff=/\+\+\+|diff --git/i.test(full);
      setMsgs(p=>[...p,{id:"cm_"+Date.now(),role:"assistant",content:full||"Done!",createdAt:Date.now()}]);
      if(hasDiff){const m=full.match(/```diff\n?([\s\S]*?)```/);const raw=m?m[1]:full;setDiff({filepath:(full.match(/file[:\s]+([a-z0-9_/. -]+\.(tsx?|css|js|json|md))/i)?.[1])||"file",hunks:raw,added:(raw.match(/^\+/gm)||[]).length,removed:(raw.match(/^-/gm)||[]).length});setPhase("diff")}else{setPhase("applied");setTimeout(()=>setPhase("idle"),4000)}
    }catch(e){if((e as Error).name==="AbortError")return;setError(e instanceof Error?e.message:"Error");setPhase("error");setMsgs(p=>[...p,{id:"cm_"+Date.now(),role:"system",content:"Error: "+(e instanceof Error?e.message:"Failed"),createdAt:Date.now()}])}
  },[]);
  if(!open)return null;
  const hd=<div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5"><div className="flex items-center gap-2"><span className="text-base">🛠</span><span className="text-sm font-semibold text-[var(--ink)]">Improve Spark</span></div><div className="flex items-center gap-1">{onOpenFullConsole?<button type="button" onClick={onOpenFullConsole} className="rounded-full px-3 py-1 text-[11px] font-medium text-[var(--teal)] hover:bg-[var(--teal)]/10">↕ Full</button>:null}<button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div></div>;
  const db=phase==="diff"&&diff?<div className="mx-3 mb-2"><MiniDiffViewer diff={diff} onOpenFull={onOpenFullConsole}/><div className="mt-2 flex gap-2"><button type="button" onClick={()=>setShowPin(true)} className="flex-1 rounded-full bg-[var(--teal)] py-1.5 text-xs font-semibold text-white hover:brightness-105">Apply</button><button type="button" onClick={()=>{setPhase("idle");setDiff(null)}} className="flex-1 rounded-full border border-[var(--line)] py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--mist)]">Cancel</button></div></div>:null;
  const lock=useCallback(()=>{setShowPin(false);setPhase("applied");setTimeout(()=>{setPhase("idle");setDiff(null)},3000)},[]);
  return <>
    <div className="hidden lg:block"><div className="fixed right-0 top-0 z-30 flex h-dvh w-[360px] flex-col border-l border-[var(--line)] bg-[var(--bg0)] shadow-2xl animate-slide-in-left">{hd}<div className="min-h-0 flex-1 overflow-y-auto"><MiniConsoleThread messages={msgs} streaming={phase==="thinking"}/></div>{err?<div className="mx-3 mb-1 rounded-lg border border-[var(--coral)]/30 bg-[var(--coral)]/5 px-3 py-2"><p className="text-xs font-medium text-[var(--coral)]">{err}</p></div>:null}{db}<div className="shrink-0 px-3 pb-3 pt-1"><ConsoleComposer disabled={phase==="thinking"} singleLine placeholder="Tell Spark what to improve…" onSubmit={send}/></div></div></div>
    <div className="fixed inset-0 z-30 lg:hidden"><button type="button" className="absolute inset-0 bg-[rgba(10,28,34,0.45)]" onClick={onClose}/><div className="absolute inset-x-0 bottom-0 flex max-h-[60vh] flex-col rounded-t-2xl bg-[var(--bg0)] shadow-2xl animate-slide-up"><div className="flex justify-center py-2"><div className="h-1 w-10 rounded-full bg-[var(--line)]"/></div>{hd}<div className="min-h-0 flex-1 overflow-y-auto"><MiniConsoleThread messages={msgs} streaming={phase==="thinking"}/></div>{err?<div className="mx-3 mb-1 rounded-lg border border-[var(--coral)]/30 bg-[var(--coral)]/5 px-3 py-2"><p className="text-xs font-medium text-[var(--coral)]">{err}</p></div>:null}{db}<div className="shrink-0 px-3 pb-4 pt-1"><ConsoleComposer disabled={phase==="thinking"} singleLine placeholder="Tell Spark what to improve…" onSubmit={send}/></div></div></div>
    {showPin?<PinGate onUnlock={lock} onCancel={()=>setShowPin(false)}/>:null}
  </>;
}
