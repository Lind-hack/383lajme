export const TRANSLATION_EXCLUDED = 'script,style,noscript,code,pre,textarea,[translate="no"],[data-no-translate],[contenteditable="true"],[aria-hidden="true"]';
export const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt"];

/** Remember source separately from rendered text; React may update either node. */
export function captureTranslationSlot(read, write, connected, sourceLanguage = "sq") {
  return { read, write, connected, sourceLanguage, source: read(), rendered: read() };
}
export function refreshTranslationSlot(slot) {
  const current = slot.read();
  if (current !== slot.rendered) slot.source = slot.rendered = current;
  return slot.source;
}
export function applyTranslationSlot(slot, source, translation) {
  if (!slot.connected() || refreshTranslationSlot(slot) !== source) return false;
  const leading = source.match(/^\s*/)[0], trailing = source.match(/\s*$/)[0];
  slot.rendered = `${leading}${translation}${trailing}`;
  if (slot.read() !== slot.rendered) slot.write(slot.rendered);
  return true;
}
export function splitTranslationText(text, maximum = 1800) {
  const parts=[];
  while(text.length>maximum) {
    let cut=text.lastIndexOf(" ",maximum);
    if(cut<maximum/2) cut=maximum;
    parts.push(text.slice(0,cut)); text=text.slice(cut);
  }
  if(text) parts.push(text);
  return parts;
}
export function translationBatches(texts, countLimit=32, characterLimit=10000) {
  const batches=[];
  let batch=[],size=0;
  for(const text of texts) {
    if(batch.length && (batch.length>=countLimit || size+text.length>characterLimit)) {batches.push(batch);batch=[];size=0;}
    batch.push(text);size+=text.length;
  }
  if(batch.length) batches.push(batch);
  return batches;
}
