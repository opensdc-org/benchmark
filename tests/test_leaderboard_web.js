// Usage: node tests/test_leaderboard_web.js <site-root>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(process.argv[2]);
const source = fs.readFileSync(path.join(root,"leaderboard.js"),"utf8");
const data = JSON.parse(fs.readFileSync(path.join(root,"data/leaderboard.json"),"utf8"));
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
const metricKeys = [...html.matchAll(/data-rank-metric="([^"]+)"/g)].map(match => match[1]);

class Element {
  constructor(){this.value="";this.children=[];this.listeners={};this.textContent="";this.disabled=false;this.hidden=false;this.attrs={};
    this.classList={toggle:()=>{}};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  change(){this.listeners.change();} click(){this.listeners.click();}
  setAttribute(name,value){this.attrs[name]=value;}
  removeAttribute(name){delete this.attrs[name];}
  replaceChildren(...items){this.children=items.length===1 && items[0].fragment ? items[0].children : items;}
  append(...items){this.children.push(...items);}
  insertCell(){const cell=new Element();this.children.push(cell);return cell;}
}
class Option { constructor(label,value){this.label=label;this.value=value;} }
function environment(offline=false,search=""){
  const elements={};
  const sortButtons = new Map(metricKeys.map(key => {
    const button = new Element();
    button.dataset = {rankMetric:key};
    button.parentElement = new Element();
    return [key,button];
  }));
  const document={getElementById(id){return elements[id] ||= new Element();},
    querySelectorAll(selector){
      assert.equal(selector,"button[data-rank-metric]");
      return [...sortButtons.values()];
    },
    createDocumentFragment(){const e=new Element();e.fragment=true;return e;},
    createElement(){return new Element();}};
  elements['rank-dataset']=new Element();elements['rank-dataset'].value='NYX';
  elements['rank-bound']=new Element();elements['rank-bound'].value='0.001';
  const fetch=async()=>{if(offline)throw new Error('offline');return {ok:true,json:async()=>data};};
  const window={location:new URL("https://example.test/benchmark/"+search)};
  vm.runInNewContext(source,{document,Option,fetch,Intl,window,URL,URLSearchParams});
  return {elements,sortButtons};
}

function assertSort(buttons, key, direction) {
  const active = [...buttons].filter(([,button]) => button.parentElement.attrs["aria-sort"]);
  assert.deepEqual(active.map(([metric,button]) => [metric,button.parentElement.attrs["aria-sort"]]), [[key,direction]]);
}

function firstCodec(elements) {
  const cell = elements["rank-body"].children[0].children[1];
  return cell.children[0]?.textContent || cell.textContent;
}

async function main(){
  assert(!html.includes('id="rank-metric"'));
  assert.deepEqual(metricKeys.slice(0,3), ["ratio","compress_MiB_s","decompress_MiB_s"]);
  const {elements:e,sortButtons}=environment();await new Promise(setImmediate);
  assert.equal(e['rank-empty'].hidden,true);
  assert.equal(e['rank-dataset'].value,'NYX');assert.equal(e['rank-bound'].value,'0.001');
  const group=data.groups.find(g=>g.protocol.dataset==='NYX' && g.protocol.alpha===.001);
  assert(!e['rank-context'].textContent.includes(group.protocol.host));
  const first=group.entries.slice().sort((a,b)=>b.metrics.ratio-a.metrics.ratio)[0];
  assert.equal(e['rank-body'].children.length,5);
  assert.deepEqual(e['rank-body'].children.map(row=>row.className || ''),['rank-place-1','rank-place-2','rank-place-3','','']);
  assert.equal(firstCodec(e),first.display_name);
  assertSort(sortButtons,"ratio","descending");
  assert(e['rank-direction'].textContent.includes('highest first'));
  assert.equal(e['rank-body'].children[0].children.length,metricKeys.length+2);
  assert.equal(e['rank-body'].children[0].children[2].className,"rank-score");

  const byCompression = group.entries.slice().sort((a,b) => a.metrics.compress_MiB_s-b.metrics.compress_MiB_s);
  sortButtons.get("compress_MiB_s").click();
  assertSort(sortButtons,"compress_MiB_s","descending");
  assert.equal(firstCodec(e),byCompression.at(-1).display_name);
  assert.equal(e['rank-body'].children[0].children[3].className,"rank-score");
  sortButtons.get("compress_MiB_s").click();
  assertSort(sortButtons,"compress_MiB_s","ascending");
  assert.equal(firstCodec(e),byCompression[0].display_name);
  const reversedLink = new URL(e["rank-permalink"].href);
  assert.equal(reversedLink.searchParams.get("rank_order"),"asc");
  const reversed = environment(false,reversedLink.search);
  await new Promise(setImmediate);
  assertSort(reversed.sortButtons,"compress_MiB_s","ascending");
  assert.equal(firstCodec(reversed.elements),byCompression[0].display_name);

  const fastestDecode=group.entries.slice().sort((a,b)=>b.metrics.decompress_MiB_s-a.metrics.decompress_MiB_s)[0];
  sortButtons.get("decompress_MiB_s").click();
  assertSort(sortButtons,"decompress_MiB_s","descending");
  assert.equal(firstCodec(e),fastestDecode.display_name);
  sortButtons.get("ratio").click();
  assertSort(sortButtons,"ratio","descending");
  assert.equal(firstCodec(e),first.display_name);

  sortButtons.get("spectral_l1").click();
  const best=group.entries.slice().sort((a,b)=>a.metrics.spectral_l1-b.metrics.spectral_l1)[0];
  assert.equal(firstCodec(e),best.display_name);
  assertSort(sortButtons,"spectral_l1","ascending");
  assert(e['rank-direction'].textContent.includes('lowest first'));
  e['rank-dataset'].value='CESM';e['rank-dataset'].change();
  assert(e['rank-context'].textContent.includes('64 fields'));
  const exploreLink=new URL(e['rank-explore-link'].href);
  assert.equal(exploreLink.hash,'#results');assert.equal(exploreLink.searchParams.get('view_dataset'),'CESM');
  assert.equal(exploreLink.searchParams.get('view_figure'),'rd');assert(!exploreLink.searchParams.has('view_bound'));
  e['track-particle'].click();assert.equal(e['rank-empty'].hidden,false);
  assert.equal(e['experiment-hardware'].hidden,true);
  assert(e['rank-empty'].textContent.includes('No verified particle'));
  assert.equal(e['rank-dataset'].disabled,true);assert.equal(e['rank-body'].children.length,0);
  assert.equal(e['rank-scroll'].hidden,true);assert.equal(e['rank-explore-link'].hidden,true);
  e['track-domain_specific'].click();assert(e['rank-empty'].textContent.includes('domain-specific'));
  e['track-general'].click();assert.equal(e['rank-empty'].hidden,true);assert.equal(e['rank-dataset'].disabled,false);
  assert.equal(e['experiment-hardware'].hidden,false);
  const offline=environment(true);await new Promise(setImmediate);
  assert(offline.elements['rank-empty'].textContent.includes('could not be loaded'));
  const deep=environment(false,'?rank_track=general&rank_dataset=CESM&rank_bound=0.0001&rank_metric=spectral_l1');
  await new Promise(setImmediate);
  assert.equal(deep.elements['rank-dataset'].value,'CESM');assert.equal(deep.elements['rank-bound'].value,'0.0001');
  assertSort(deep.sortButtons,"spectral_l1","ascending");
  const link=new URL(deep.elements['rank-permalink'].href);
  assert.equal(link.hash,'#leaderboard');assert.equal(link.searchParams.get('rank_metric'),'spectral_l1');
  const oldLink=environment(false,'?rank_metric=compress_MB_s');
  await new Promise(setImmediate);
  assertSort(oldLink.sortButtons,"compress_MiB_s","descending");
  console.log('Leaderboard controls: column sorting, ranking links, cohort selection, empty tracks and offline state passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
