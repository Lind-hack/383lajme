import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(){const s=await createClient();const {data:m}=await s.from("markets").select("id").eq("slug","test-only-argjentina-spanja-grafik-email-20260716").single();if(!m)return NextResponse.json({points:[]});const {data}=await s.from("market_snapshots").select("created_at,market_prob,evidence").eq("market_id",m.id).eq("oracle_kind","test_live_simulation").order("created_at",{ascending:true});return NextResponse.json({test_only:true,points:(data??[]).map(x=>({createdAt:x.created_at,argentina:Number(x.market_prob)*100,...((Array.isArray(x.evidence)?x.evidence[0]:{}) as object)}))},{headers:{"Cache-Control":"no-store"}});}
