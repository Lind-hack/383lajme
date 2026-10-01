import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { buildBotaSnapshot } from './bota-publication.mjs';
function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 return url&&key?createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(10000)})}}):null;
}
export const readBotaSnapshot = cache(async () => {
 const client=database();if(!client)return null;
 const {data:run,error}=await client.from('bota_coverage_runs').select('day').order('day',{ascending:false}).limit(1).maybeSingle();
 if(error||!run)return null;
 const cutoff=new Date(Date.parse(run.day+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);
 const {data,error:readError}=await client.from('bota_coverage_articles').select('data').gte('first_seen',cutoff).lte('first_seen',run.day);
 if(readError)return null;
 return buildBotaSnapshot((data??[]).map(row=>row.data),run.day);
});
export async function readBotaArticle(id){
 if(!/^[a-f0-9]{64}$/.test(id))return null;
 const client=database();if(!client)return null;
 const {data,error}=await client.from('bota_coverage_articles').select('data').eq('id',id).maybeSingle();
 return error?null:data?.data??null;
}
