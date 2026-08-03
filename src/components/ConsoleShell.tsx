"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConsoleThread } from "./ConsoleThread";
import { ConsoleComposer } from "./ConsoleComposer";
import { getConsoleSessionId } from "@/lib/mini-console-store";
import type { ConsoleMessage } from "@/lib/types";
export function ConsoleShell(){
  const[phase,setPhase]=useState<"idle"|"thinking"|"applied"|"error">("idle");
  const[msgs,setMsgs]=useState<ConsoleMessage[]>([]);
  const[err,setError]=useState("");
  const sid=useRef(getConsoleSessionId());
  const scroller=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=scroller.current;if(el)el.scrollTop=el.scrollHeight},[msgs]);
  const send=useCallback(async(text:string)=>{
    setPhase("thinking");setError("");
    const aid="cm_"+(Date.now()+1);
    setMsgs(p=>[...p,{id:"cm_"+Date.now(),role:"user",content:text,createdAt:Date.now()},{id:aid,role:"assistant",content:"",createdAt:Date.now()}]);
    try{
      const res=await fetch("/api/console/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid.current,message:text})});
      if(!res.ok)throw new Error(((await res.json().catch(()=>({}))) as {error?:string}).error||"Error "+res.status);
      let full="";const r=res.body!.getReader();const d=new TextDecoder();let buf="";
      while(true){const{done,value}=await r.read();if(done)break;buf+=d.decode(value,{stream:true});const parts=buf.split("\n\n");buf=parts.pop()??"";for(const p of parts){const ls=p.split("\n");let ev="message",dl="";for(const l of ls){if(l.startsWith("event:"))ev=l.slice(6).trim();if(l.startsWith("data:"))dl+=l.slice(5).trim()}if(!dl)continue;try{const d2=JSON.parse(dl) as {text?:string;error?:string};if(ev==="delta"&&d2.text){full+=d2.text;setMsgs(p=>p.map(m=>m.id===aid?{...m,content:m.content+d2.text}:m))}if(ev==="error"&&d2.error)throw new Error(d2.error);if(ev==="done"){full=d2.text||full;setMsgs(p=>p.map(m=>m.id===aid?{...m,content:full}:m))}}catch(e){if(e instanceof SyntaxError)continue;throw e}}}
      setPhase("idle");
    }catch(e){setError(e instanceof Error?e.message:"Error");setPhase("error")}
  },[]);
  return <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-[var(--bg0)]">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="atmosphere-blob atmosphere-blob-a"/><div className="atmosphere-blob atmosphere-blob-b"/><div className="atmosphere-grain"/></div>
    <header className="safe-top relative z-10 flex shrink-0 items-center gap-3 px-4 py-2.5" style={{minHeight:48}}><a href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>Back to Spark</a><div className="flex-1"/><span className="text-base font-semibold text-[var(--ink)]">🛠 Improve Spark</span></header>
    <main ref={scroller} className="relative z-10 mx-auto w-full max-w-2xl flex-1 overflow-y-auto"><ConsoleThread messages={msgs} streaming={phase==="thinking"}/></main>
    {err?<div className="relative z-10 mx-auto mb-2 w-full max-w-2xl rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/5 px-4 py-2.5"><p className="flex items-center gap-2 text-sm font-medium text-[var(--coral)]">⚠ {err}</p></div>:null}
    <div className="relative z-10 shrink-0 border-t border-[var(--line)]/60 bg-[color-mix(in_srgb,var(--bg0)_82%,transparent)] backdrop-blur-md"><div className="mx-auto w-full max-w-2xl px-4 py-3"><ConsoleComposer disabled={phase==="thinking"} placeholder="Tell Spark what to improve…" onSubmit={send}/></div></div>
  </div>;
}
