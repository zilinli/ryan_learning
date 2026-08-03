import type { MiniConsoleState } from "./types";
const K="spark.miniConsole",CK="spark.consoleSessionId";
const D:MiniConsoleState={open:false,sessionId:"",phase:"idle",userMessage:"",agentMessage:""};
export function loadMiniConsoleState():MiniConsoleState{try{const r=localStorage.getItem(K);return r?{...D,...JSON.parse(r)}:{...D}}catch{return{...D}}}
export function saveMiniConsoleState(s:MiniConsoleState){try{localStorage.setItem(K,JSON.stringify(s))}catch{}}
export function clearMiniConsoleState(){try{localStorage.removeItem(K)}catch{}}
export function getConsoleSessionId(){const e=localStorage.getItem(CK);if(e)return e;const id=`cs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;localStorage.setItem(CK,id);return id}
export function setConsoleSessionId(id:string){localStorage.setItem(CK,id)}
