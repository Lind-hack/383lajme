"use client";
import {useEffect,useSyncExternalStore} from 'react';
import {createAuthUserStore} from './auth-user-store.mjs';
import {createClient} from './supabase/client';
const store=createAuthUserStore();
export const acceptAuthUser=store.acceptUser;
export function useAuthUser() {
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 useEffect(()=>{
  const configured=process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  store.start(configured ? createClient().auth : null);
 },[]);
 return snapshot;
}
