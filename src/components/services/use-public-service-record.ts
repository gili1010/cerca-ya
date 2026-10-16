"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
export function usePublicServiceRecord<T>(initial:T,id:string,read:(client:SupabaseClient<Database>,id:string)=>Promise<T|null>){
 const [data,setData]=useState<T|null>(initial),[error,setError]=useState(""),[checking,setChecking]=useState(false),lock=useRef(false),live=useRef(true);
 const refresh=useCallback(async()=>{
  if(lock.current)return;lock.current=true;setChecking(true);
  try{const client=getSupabaseBrowserClient();if(!client)throw new Error();const current=await read(client,id);if(live.current){setData(current);setError("");}}
  catch{if(live.current){setData(null);setError("No pudimos comprobar la disponibilidad. Volvé a intentar.");}}
  finally{lock.current=false;if(live.current)setChecking(false);}
 },[id,read]);
 useEffect(()=>{live.current=true;const focus=()=>void refresh(),visible=()=>{if(document.visibilityState==="visible")focus();},timer=setInterval(()=>{if(document.visibilityState==="visible")focus();},300000);
  window.addEventListener("focus",focus);window.addEventListener("online",focus);document.addEventListener("visibilitychange",visible);
  return()=>{live.current=false;clearInterval(timer);window.removeEventListener("focus",focus);window.removeEventListener("online",focus);document.removeEventListener("visibilitychange",visible);};
 },[refresh]);
 return{data:checking?null:data,error,checking,refresh};
}

