import type { MiniConsoleState } from "./types";
const K="spark.miniConsole",CK="spark.consoleSessionId";
const D:MiniConsoleState={open:false,sessionId:"",phase:"idle",userMessage:"",agentMessage:""};

const isBrowser = typeof localStorage !== "undefined";

export function loadMiniConsoleState():MiniConsoleState{
  if(!isBrowser)return{...D};
  try{const r=localStorage.getItem(K);return r?{...D,...JSON.parse(r)}:{...D}}catch{return{...D}}
}
export function saveMiniConsoleState(s:MiniConsoleState){
  if(!isBrowser)return;
  try{localStorage.setItem(K,JSON.stringify(s))}catch{}
}
export function clearMiniConsoleState(){
  if(!isBrowser)return;
  try{localStorage.removeItem(K)}catch{}
}
export function getConsoleSessionId():string{
  if(!isBrowser)return `cs_ssr_${Date.now()}`;
  const e=localStorage.getItem(CK);if(e)return e;
  const id=`cs_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  localStorage.setItem(CK,id);return id;
}
export function setConsoleSessionId(id:string){
  if(!isBrowser)return;
  localStorage.setItem(CK,id);
}
