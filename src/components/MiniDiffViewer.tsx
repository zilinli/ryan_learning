"use client";
import { DiffViewer } from "./DiffViewer";
import type { DiffBlock } from "@/lib/types";
type Props={diff:DiffBlock;onOpenFull?:()=>void};
export function MiniDiffViewer({diff,onOpenFull}:Props){return <div><DiffViewer diff={diff} compactLines={5}/><div className="mt-1 text-right"><button type="button" onClick={onOpenFull} className="text-[11px] font-medium text-[var(--teal)] hover:underline">Show full diff \u2195</button></div></div>}
