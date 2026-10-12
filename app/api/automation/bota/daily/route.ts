import {NextResponse,type NextRequest} from 'next/server';
import {revalidatePath} from 'next/cache';
import {automationDenied} from '@/lib/require-automation';
import {createAdminClient} from '@/lib/supabase/admin';
import {kosovoDay,validateBotaPublication,BOTA_DAILY_TARGET,BOTA_COUNTRY_CAP,BOTA_OUTLET_CAP} from '@/lib/bota-publication.mjs';
import {readBotaPages} from '@/lib/bota-pagination.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const denied=automationDenied(request);if(denied)return denied;
 const db=createAdminClient();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 const date=kosovoDay();
 // Page all eight days; 400/day exceeds PostgREST's 1,000-row default.
 const cutoff=new Date(Date.parse(date+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
 let run,recent;
 try {
  const [result,rows]=await Promise.all([db.from('bota_coverage_runs').select('day,model,reasoning_effort,article_count').eq('day',date).maybeSingle(),readBotaPages(()=>db.from('bota_coverage_cards').select('id,first_seen,data').gte('first_seen',cutoff).lte('first_seen',date).order('id'))]);
  if(result.error)throw result.error;run=result.data;recent=rows;
 }catch{return NextResponse.json({error:'Cannot read publication context'},{status:503});}
 const dailyCount=run?.article_count??0;
 const countryCounts:Record<string,number>={},outletCounts:Record<string,number>={};
 for(const row of recent){if(row.first_seen!==date)continue;const {country,outlet}=row.data;countryCounts[country]=(countryCounts[country]??0)+1;const key=JSON.stringify([country,outlet]);outletCounts[key]=(outletCounts[key]??0)+1;}
 return NextResponse.json({date,dailyCount,dailyMinimum:BOTA_DAILY_TARGET,dailyMaximum:BOTA_DAILY_TARGET,countryMaximum:BOTA_COUNTRY_CAP,outletMaximum:BOTA_OUTLET_CAP,countryCounts,outletCounts,alreadyPublished:dailyCount>=BOTA_DAILY_TARGET,run,knownIds:recent.map(a=>a.id)});
}
export async function POST(request:NextRequest){
 const denied=automationDenied(request);if(denied)return denied;
 let packet;try{packet=validateBotaPublication(await request.json())}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid publication'},{status:422})}
 const db=createAdminClient();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 const {data,error}=await db.rpc('publish_bota_coverage_v3',{p_day:packet.date,p_articles:packet.articles});
 if(error)return NextResponse.json({error:'Publication failed'},{status:503});
 revalidatePath('/bota-per-kosoven');revalidatePath('/');revalidatePath('/toni');
 return NextResponse.json({date:packet.date,published:data.published,alreadyPublished:data.at_capacity,inserted:data.inserted,dailyCount:data.total,articleIds:data.article_ids});
}
