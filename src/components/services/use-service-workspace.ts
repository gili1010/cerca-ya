"use client";
import {useEffect,useState,useCallback} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {readMyServiceProvider,readServiceCategories} from "@/lib/services/client";
import {serviceUiError} from "@/lib/services/frontend";
import type {OwnedServiceProvider,PublicServiceCategory} from "@/types/services";
export function useServiceWorkspace() {
 const [provider,setProvider]=useState<OwnedServiceProvider|null>(null),[categories,setCategories]=useState<PublicServiceCategory[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[suspended,setSuspended]=useState(true),[attempt,setAttempt]=useState(0);
 const reload=useCallback(()=>{setLoading(true);setAttempt(v=>v+1);},[]);
 useEffect(()=>{
  let live=true;
  async function load(){
   try {const client=getSupabaseBrowserClient();if(!client)throw new Error();
    const [profile,cats,suspension]=await Promise.all([readMyServiceProvider(client),readServiceCategories(client),client.rpc("is_my_account_suspended",{})]);
    if(suspension.error||typeof suspension.data!=="boolean")throw new Error();
    if(live){setProvider(profile);setCategories(cats);setSuspended(suspension.data);setError("");}
   }catch(cause){if(live){setError(serviceUiError(cause,"No pudimos cargar tu espacio de servicios. Volvé a intentar."));setProvider(null);setSuspended(true);}}
   finally{if(live)setLoading(false);}
  }void load();return()=>{live=false;};
 },[attempt]);
 return{provider,setProvider,categories,loading,error,suspended,reload};
}

