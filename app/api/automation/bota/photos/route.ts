import {NextResponse,type NextRequest} from 'next/server';
import {revalidatePath} from 'next/cache';
import {automationDenied} from '@/lib/require-automation';
import {createAdminClient} from '@/lib/supabase/admin';
import {approvedBotaImage} from '@/lib/bota-image.mjs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const denied=automationDenied(request);if(denied)return denied;
 const after=request.nextUrl.searchParams.get('after');
 if(after && !/^[a-f0-9]{64}$/.test(after))return NextResponse.json({error:'Invalid cursor'},{status:400});
 const db=createAdminClient();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 let query=db.from('bota_coverage_articles').select('id,data').order('id').limit(20);
 if(after)query=query.gt('id',after);
 const {data,error}=await query;
 if(error)return NextResponse.json({error:'Photo context unavailable'},{status:503});
 return NextResponse.json({articles:(data??[]).filter(row=>!approvedBotaImage(row.data)).map(row=>({...row.data,id:row.id})),after:data?.at(-1)?.id??null,hasMore:data?.length===20},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(request:NextRequest){
 const denied=automationDenied(request);if(denied)return denied;
 let input;try{input=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 const photo=approvedBotaImage(input);
 if(!photo || !/^[a-f0-9]{64}$/.test(input.id??'') || !/^[a-f0-9]{64}$/.test(input.sourceHash??''))return NextResponse.json({error:'Verified photo and original article hash required'},{status:422});
 const db=createAdminClient();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 const {data,error}=await db.rpc('repair_bota_photo',{p_id:input.id,p_source_hash:input.sourceHash,p_photo:photo});
 if(error)return NextResponse.json({error:'Photo repair failed'},{status:503});
 if(!data)return NextResponse.json({error:'Article changed or unavailable'},{status:409});
 revalidatePath('/bota-per-kosoven');revalidatePath(`/bota-per-kosoven/artikull/${input.id}`);revalidatePath('/');
 return NextResponse.json({id:input.id,updated:true});
}
