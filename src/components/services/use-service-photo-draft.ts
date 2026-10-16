"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {ArticlePhotoDraft} from "@/components/personal-listings/article-photos";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database";
import {prepareServicePhoto,uploadServicePhoto} from "@/lib/services/images";
import {serviceUiError} from "@/lib/services/frontend";
export function useServicePhotoDraft(limit=5){
 const [photos,setPhotos]=useState<ArticlePhotoDraft[]>([]),[preparing,setPreparing]=useState(false),[error,setError]=useState("");
 const latest=useRef(photos),urls=useRef(new Set<string>()),lock=useRef(false),live=useRef(true);
 const change=useCallback((next:ArticlePhotoDraft[])=>{
  const retained=new Set(next.flatMap(item=>item.localUrl?[item.localUrl]:[]));
  for(const item of latest.current)if(item.localUrl&&!retained.has(item.localUrl)){URL.revokeObjectURL(item.localUrl);urls.current.delete(item.localUrl);}
  latest.current=next;setPhotos(next);
 },[]);
 const reset=useCallback((paths:string[])=>{for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();change(paths.map(path=>({key:path,path,localUrl:null,photo:null})));setError("");},[change]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;for(const url of urls.current)URL.revokeObjectURL(url);};},[]);
 async function add(files:File[]){
  if(lock.current)return;if(latest.current.length+files.length>limit){setError(`Podés agregar hasta ${limit} ${limit===1?"foto":"fotos"}.`);return;}
  lock.current=true;setPreparing(true);setError("");const added:ArticlePhotoDraft[]=[];
  try{for(const file of files){const photo=await prepareServicePhoto(file);if(!live.current)return;const localUrl=URL.createObjectURL(photo.blob);urls.current.add(localUrl);added.push({key:crypto.randomUUID(),photo,localUrl,path:null});}if(live.current)change([...latest.current,...added]);}
  catch(cause){for(const item of added)if(item.localUrl){URL.revokeObjectURL(item.localUrl);urls.current.delete(item.localUrl);}if(live.current)setError(serviceUiError(cause,"No pudimos preparar la foto. Elegí JPEG, PNG o WebP de hasta 10 MiB."));}
  finally{lock.current=false;if(live.current)setPreparing(false);}
 }
 async function upload(client:SupabaseClient<Database>,kind:"providers"|"listings",id:string,guard?:()=>Promise<void>){
  const next=[...latest.current];
  for(let index=0;index<next.length;index++){const item=next[index];if(item.path)continue;if(!item.photo)throw new Error("Revisá las fotos antes de guardar.");
   if(!live.current)throw new Error("Volvé a cargar antes de continuar.");if(guard)await guard();
   const path=await uploadServicePhoto(client,kind,id,item.photo);next[index]={...item,path};if(live.current)change([...next]);
  }return next.flatMap(item=>item.path?[item.path]:[]);
 }
 return{photos,preparing,error,change,reset,add,upload};
}

