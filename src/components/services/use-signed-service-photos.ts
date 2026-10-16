"use client";
import {useCallback,useEffect,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {signServicePhotos} from "@/lib/services/images";
export function useSignedServicePhotos(paths:string[]){
 const {user}=useAuth();const key=JSON.stringify([...new Set(paths)].sort()),account=user?.id??null;
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<{key:string;account:string|null;urls:Record<string,string>;error:string}|null>(null);
 const refresh=useCallback(()=>setAttempt(v=>v+1),[]);
 useEffect(()=>{
  let live=true,generation=0,expires=0;let timer:ReturnType<typeof setTimeout>|undefined;
  const selected:string[]=JSON.parse(key);
  async function load(){
   const current=++generation;if(timer)clearTimeout(timer);
   try{const client=getSupabaseBrowserClient();if(!client)throw new Error();const signed=await signServicePhotos(client,selected);
    if(!live||current!==generation)return;expires=signed.expiresAt;
    setResult({key,account,urls:signed.urls,error:signed.unavailable.length?"Algunas fotos no están disponibles.":""});
    if(selected.length)timer=setTimeout(()=>void load(),Math.max(1000,expires-Date.now()-60000));
   }catch{if(live&&current===generation){expires=0;setResult({key,account,urls:{},error:selected.length?"No pudimos cargar las fotos. Volvé a intentar.":""});}}
  }void load();
  const focus=()=>{if(selected.length&&Date.now()>=expires-60000)void load();},visible=()=>{if(document.visibilityState==="visible")focus();};
  window.addEventListener("focus",focus);window.addEventListener("online",refresh);document.addEventListener("visibilitychange",visible);
  return()=>{live=false;if(timer)clearTimeout(timer);window.removeEventListener("focus",focus);window.removeEventListener("online",refresh);document.removeEventListener("visibilitychange",visible);};
 },[key,account,attempt,refresh]);
 const current=result?.key===key&&result.account===account?result:null;
 return{urls:current?.urls??{},error:current?.error??"",refresh};
}

