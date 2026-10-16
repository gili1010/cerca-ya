"use client";
import {useEffect,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/components/auth/auth-provider";
import {loginUrl} from "@/lib/auth/redirect";
import {PublicationAuthGate} from "@/components/personal-listings/publication-auth-gate";
export function ServiceAuthGate({children,returnTo}:{children:ReactNode;returnTo:string}){
 const {user,loading}=useAuth(),router=useRouter();
 useEffect(()=>{if(!loading&&!user)router.replace(loginUrl(returnTo));},[loading,user?.id,router,returnTo]);
 return <PublicationAuthGate services returnTo={returnTo}>{children}</PublicationAuthGate>;
}

