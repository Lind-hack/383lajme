import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { themeBootstrap } from "./site-theme.mjs";
function boot(stored,cookie="",blocked=false){const root={dataset:{},style:{}};vm.runInNewContext(themeBootstrap,{localStorage:{getItem(){if(blocked)throw Error("blocked");return stored;}},document:{cookie,documentElement:root}});return root;}
test("saved appearance is applied before hydration and survives storage restrictions",()=>{
 assert.equal(boot("dark").dataset.theme,"dark");
 assert.equal(boot("light","383_theme=dark").dataset.theme,"light");
 assert.equal(boot(null,"383_theme=dark",true).dataset.theme,"dark");
 assert.equal(boot("invalid","383_theme=light").style.colorScheme,"light");
 assert.equal(boot(null).dataset.theme,"light");
 assert.equal(boot(null,"383_theme=darkness").dataset.theme,"light");
});
