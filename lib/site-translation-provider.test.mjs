import { test } from "node:test";
import assert from "node:assert/strict";
import { translateSiteTexts } from "./site-translation-provider.mjs";
test("invalid fast-provider response fails over without changing article numbers", async () => {
  const calls=[];
  const result=await translateSiteTexts(["383 Monedha"],"de",{env:{GROQ_API_KEY:"test",GOOGLE_API_KEY:"test2"},fetchImpl:async(url,options)=>{
    calls.push(url); assert.ok(options.signal); const body=JSON.parse(options.body);
    if(calls.length===1) {assert.equal(body.reasoning_effort,"none");return {ok:true,json:async()=>({choices:[{message:{content:'{"language":"de","translations":["384 Münzen"]}'}}]})};}
    assert.equal(options.headers["x-goog-api-key"],"test2");
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"language":"de","translations":["383 Münzen"]}'}]}}]})};
  }});
  assert.deepEqual(result,["383 Münzen"]); assert.equal(calls.length,2);
});
test("cancelled, unconfigured and exhausted providers return no invented translation",async()=>{
  await assert.rejects(translateSiteTexts(["Lajme"],"en",{env:{}}),/unavailable/);
  await assert.rejects(translateSiteTexts(["Lajme"],"en",{env:{GROQ_API_KEY:"test"},signal:AbortSignal.abort()}),/cancelled/);
  await assert.rejects(translateSiteTexts(["Lajme"],"en",{env:{GROQ_API_KEY:"test"},fetchImpl:async()=>({ok:false,status:429})}),/unavailable/);
});
