import {NextResponse,type NextRequest} from 'next/server';
import {revalidatePath} from 'next/cache';
import {automationDenied} from '@/lib/require-automation';
import {createAdminClient} from '@/lib/supabase/admin';
import {kosovoDay,validateBotaPublication} from '@/lib/bota-publication.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const denied=automationDenied(request);if(denied)return denied;
 const db=createAdminClient();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 const date=kosovoDay();
 const [{data:run,error},{data:recent,error:readError}]=await Promise.all([db.from('bota_coverage_runs').select('day,model,reasoning_effort,article_count').eq('day',date).maybeSingle(),db.from('bota_coverage_articles').select('id').limit(10000)]);
 if(error||readError)return NextResponse.json({error:'Cannot read publication context'},{status:503});
 const dailyCount=run?.article_count??0;
 return NextResponse.json({date,dailyCount,dailyMinimum:50,dailyMaximum:100,alreadyPublished:dailyCount>=100,run,knownIds:(recent??[]).map(a=>a.id)});
}
export async function POST(request:NextRequest){
 const denied=automationDenied(request);if(denied)return denied;
 let packet;try{packet=validateBotaPublication(await request.json())}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid publication'},{status:422})}
 const db=createAdminClient();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 const {data,error}=await db.rpc('publish_bota_coverage_v2',{p_day:packet.date,p_articles:packet.articles});
 if(error)return NextResponse.json({error:'Publication failed'},{status:503});
 revalidatePath('/bota-per-kosoven');revalidatePath('/');revalidatePath('/toni');
 return NextResponse.json({date:packet.date,published:data.published,alreadyPublished:data.at_capacity,inserted:data.inserted,dailyCount:data.total,articleIds:data.article_ids});
}
