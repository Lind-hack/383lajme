"use client";

const timeline = [
  ["30'", "0-0", "Argjentina dominon: më shumë raste, goditje në portë dhe xG"],
  ["43'", "1-0", "Gol për Spanjën"],
  ["65'", "2-0", "Goli i dytë i Spanjës"],
  ["82'", "2-1", "Argjentina rikthehet në lojë"],
  ["92'", "2-2", "Argjentina barazon pak para fundit"],
  ["112'", "2-3", "Gol i Argjentinës në kohën shtesë"],
  ["FT", "2-3", "TEST ONLY: Argjentina kampione"],
];
const stats = [
  ["Gola të pritshëm (xG)", "2.84", "1.96", 59],
  ["Goditje totale", "18", "13", 58],
  ["Goditje në portë", "9", "6", 60],
  ["Posedim", "54%", "46%", 54],
  ["Këndore", "7", "5", 58],
  ["Faulle", "12", "14", 46],
  ["Kartonë të verdhë", "2", "3", 40],
  ["Kartonë të kuq", "0", "0", 50],
];
export default function TestLiveArgentinaSpain() {
 return <main style={{minHeight:"100vh",background:"#151a1f",color:"#edf3f8",padding:"42px max(24px,6vw)",fontFamily:"Arial,sans-serif"}}>
  <div style={{maxWidth:1120,margin:"auto"}}>
   <div style={{color:"#ff6b35",fontWeight:800,fontSize:13,letterSpacing:1}}>TEST ONLY · SIMULIM LIVE · JO TË DHËNA REALE</div>
   <h1 style={{fontSize:36,margin:"10px 0 6px"}}>Argjentina 3 - 2 Spanja</h1><p style={{color:"#aeb9c5",marginTop:0}}>Finale e simuluar · Koha shtesë · ESPN event 760517 dhe Flashscore janë vetëm referenca për ndeshjen reale të së dielës.</p>
   <section style={{background:"#1c242c",border:"1px solid #35424e",borderRadius:16,padding:24,marginTop:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b>Grafiku krahasues i gjasave</b><span style={{color:"#ff6b35",fontWeight:800}}>FT · TEST</span></div>
    <svg viewBox="0 0 1000 280" width="100%" height="280" style={{marginTop:16}} aria-label="Grafik i simuluar i gjasave"><g stroke="#40505d" strokeDasharray="3 5">{[30,90,150,210].map(y=><line key={y} x1="0" x2="940" y1={y} y2={y}/>)}</g><polyline fill="none" stroke="#ff6b35" strokeWidth="4" points="0,120 250,80 420,45 550,95 700,145 820,90 940,30"/><polyline fill="none" stroke="#c5b8a8" strokeWidth="4" points="0,100 250,145 420,180 550,130 700,90 820,145 940,220"/><text x="950" y="35" fill="#ff6b35" fontSize="18">Argjentina 72%</text><text x="950" y="225" fill="#c5b8a8" fontSize="18">Spanja 28%</text></svg>
   </section>
   <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginTop:24}}>
    <div style={{background:"#1c242c",borderRadius:16,padding:22}}><h2 style={{marginTop:0}}>Rrjedha e ndeshjes</h2>{timeline.map(([m,s,t])=><div key={m} style={{borderTop:"1px solid #33404b",padding:"12px 0",display:"grid",gridTemplateColumns:"52px 48px 1fr",gap:10}}><b style={{color:"#ff6b35"}}>{m}</b><b>{s}</b><span style={{color:"#c7d1db"}}>{t}</span></div>)}</div>
    <div style={{background:"#1c242c",borderRadius:16,padding:22}}><h2 style={{marginTop:0}}>Statistikat e ndeshjes</h2><p style={{fontSize:12,color:"#ffb08c"}}>Të dhëna të simuluara për testim. Flashscore do të përdoret vetëm për statistika reale live.</p>{stats.map(([l,a,b,p])=><div key={l} style={{margin:"18px 0"}}><div style={{display:"flex",justifyContent:"space-between",fontWeight:700}}><span>{a}</span><span>{l}</span><span>{b}</span></div><div style={{height:9,background:"#2b343d",borderRadius:9,marginTop:7,display:"flex"}}><span style={{width:`${p}%`,background:"#ff6b35",borderRadius:"9px 0 0 9px"}}/><span style={{flex:1,background:"#b9ad9f",borderRadius:"0 9px 9px 0"}}/></div></div>)}</div>
   </section>
  </div>
 </main>;
}
