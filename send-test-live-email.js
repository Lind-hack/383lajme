(async()=>{const nodemailer=require('nodemailer');
const user=process.env.GMAIL_USER,pass=(process.env.GMAIL_APP_PASSWORD||'').replace(/\s+/g,'');
if(!user||!pass)throw new Error('SMTP not configured');
const t=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user,pass}});
await t.sendMail({from:user,to:'lindsylqa@gmail.com',subject:'[TEST ONLY] Argjentina–Spanja · live simulation tick',html:'<div style="font-family:Arial;background:#111827;color:#fff;padding:28px"><div style="color:#f97316;font-weight:800">TEST ONLY · SIMULIM · JO TË DHËNA REALE</div><h1>Argjentina 0–0 Spanja · 16\'</h1><p>Ky është një email testues nga stream-i i izoluar dy-minutësh. Nuk lidhet me tregun real, ESPN, bilancet, ose settlement.</p><div style="background:#1f2937;padding:16px;border-radius:12px">xG 0.21–0.18 · Goditje 4–3 · Posedim 49–51 · Argjentina 48% / Spanja 52%</div></div>'});
console.log('test_only_email_sent');})();
