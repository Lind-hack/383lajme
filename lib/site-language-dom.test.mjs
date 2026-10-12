import {test} from "node:test";
import assert from "node:assert/strict";
import {captureTranslationSlot,refreshTranslationSlot,applyTranslationSlot,splitTranslationText,translationBatches} from "./site-language-dom.mjs";
test("switching EN then DE then SQ always uses original source, including whitespace",()=>{
  let value="  Sot \n";
  const slot=captureTranslationSlot(()=>value,v=>{value=v;},()=>true);
  applyTranslationSlot(slot,slot.source,"Today"); assert.equal(value,"  Today \n");
  assert.equal(refreshTranslationSlot(slot),"  Sot \n");
  applyTranslationSlot(slot,slot.source,"Heute"); assert.equal(value,"  Heute \n");
  applyTranslationSlot(slot,slot.source,slot.source.trim()); assert.equal(value,"  Sot \n");
});
test("late translation cannot overwrite live React content or detached navigation nodes",()=>{
  let value="Lajmi i vjetër",connected=true;
  const slot=captureTranslationSlot(()=>value,v=>{value=v;},()=>connected);
  const original=slot.source;
  value="Lajmi i ri";
  assert.equal(applyTranslationSlot(slot,original,"Old news"),false);
  assert.equal(slot.source,"Lajmi i ri");
  connected=false;
  assert.equal(applyTranslationSlot(slot,slot.source,"New news"),false);
  assert.equal(value,"Lajmi i ri");
});
test("long article segmentation preserves all original characters and request budgets",()=>{
  const text="Lajm i verifikuar me 383 monedha. ".repeat(800);
  const parts=splitTranslationText(text);
  assert.equal(parts.join(""),text); assert.ok(parts.every(part=>part.length<=1800));
  const batches=translationBatches(parts);
  assert.ok(batches.every(batch=>batch.length<=32 && batch.join("").length<=10000));
});
