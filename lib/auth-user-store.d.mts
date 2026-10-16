import type {SupabaseClient,User} from '@supabase/supabase-js';
export type AuthUserSnapshot = {user:User|null;ready:boolean};
export function createAuthUserStore(): {
 getSnapshot():AuthUserSnapshot;
 getServerSnapshot():AuthUserSnapshot;
 subscribe(listener:()=>void):()=>void;
 acceptUser(user:User|null):void;
 start(auth:Pick<SupabaseClient['auth'],'getSession'|'onAuthStateChange'>|null):void;
};
