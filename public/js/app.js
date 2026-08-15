
const state={resources:[],categories:[],toolkit:[],updates:[],fulltext:[],sources:[],filter:"All",mode:"search",favorites:JSON.parse(localStorage.getItem("rbv3_favs")||"[]"),custom:JSON.parse(localStorage.getItem("rbv3_custom")||"[]")};

function load(){
  const bundled=window.RESOURCE_BANK_DATA;
  if(!bundled){
    const box=document.querySelector("#results");
    if(box){box.style.display="block";box.innerHTML='<div class="empty"><b>Resource Bank data failed to load.</b></div>';}
    return;
  }
  state.resources=bundled.resources||[];
  state.categories=bundled.categories||[];
  state.toolkit=bundled.toolkit||[];
  state.updates=bundled.updates||[];
  state.fulltext=window.RESOURCE_BANK_FULLTEXT||[];
  mergeLocalKnowledgeIntoSearch();
  state.sources=window.RESOURCE_BANK_SOURCES||[];
  render();
  const status=document.querySelector("#appStatus");
  if(status){
    const pages=state.sources.reduce((n,s)=>n+(s.pages||0),0);
    status.innerHTML=`<b>Full-document search:</b> Ready<br><b>Publications indexed:</b> ${state.sources.length}<br><b>Pages indexed:</b> ${pages}<br><b>Searchable sections:</b> ${state.fulltext.length}<br><b>Compiled Q&A cards:</b> ${state.resources.length}<br><b>AI mode:</b> Uses the same full-document index through /api/ask`;
  }
}
const all=()=>[...state.resources,...state.custom];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
function render(){
  document.querySelector("#toolkit").innerHTML=state.toolkit.map(t=>`<div class="tool" onclick="quick(${JSON.stringify(t.query)})"><div class="toolIcon">${t.icon}</div><b>${esc(t.label)}</b></div>`).join("");
  const cats=state.categories.map(c=>`<div class="cat" onclick="quick(${JSON.stringify(c.name)})"><div class="catIcon">${c.icon}</div><b>${esc(c.name)}</b></div>`).join("");
  document.querySelector("#cats").innerHTML=cats; document.querySelector("#browseCats").innerHTML=cats;
  document.querySelector("#updates").innerHTML=state.updates.map(u=>`<div class="update"><div class="fileI">📄</div><div class="m"><b>${esc(u.title)}</b><small>${esc(u.meta)}</small></div><span class="badge">${esc(u.type)}</span></div>`).join("");
  renderDocs(); renderFavs(); renderCustom();
  const legacyCategory=document.querySelector("#rCategory");
  if(legacyCategory) legacyCategory.innerHTML=state.categories.map(c=>`<option>${esc(c.name)}</option>`).join("");
}
function renderDocs(){
 const docs=(state.sources||[]).map(s=>`
   <div class="docrow">
     <b>${esc(s.title)}</b>
     <small>${esc(s.subtitle)} • ${esc(s.date)} • ${s.pages} indexed pages • ${s.blocks} searchable sections${s.restricted?" • RESTRICTED":""}${s.legacy?" • OLDER SUPPLIED EDITION":""}${s.xfa?" • XFA FORM":""}</small>
     ${s.document?`<a href="${esc(s.document)}" target="_blank">Open source PDF →</a>`:""}
   </div>`).join("");
 document.querySelectorAll("#docs").forEach(el=>el.innerHTML=docs);
}
function quick(q){showHome();document.querySelector("#search").value=q;search();}
function score(r,words,q){
 const title=(r.title||"").toLowerCase(),
       question=(r.question||"").toLowerCase(),
       ans=(r.answer||"").toLowerCase(),
       kw=(r.keywords||[]).join(" ").toLowerCase(),
       cat=((r.category||"")+" "+(r.subCategory||"")).toLowerCase(),
       src=(r.source||"").toLowerCase();
 let s=0;
 const phrase=q.trim();
 if(title.includes(phrase))s+=20;
 if(question.includes(phrase))s+=18;
 if(kw.includes(phrase))s+=16;
 if(cat.includes(phrase))s+=12;
 if(src.includes(phrase))s+=6;
 if(ans.includes(phrase))s+=5;
 words.forEach(w=>{
   if(title.includes(w))s+=6;
   if(question.includes(w))s+=6;
   if(kw.includes(w))s+=5;
   if(cat.includes(w))s+=4;
   if(src.includes(w))s+=2;
   if(ans.includes(w))s+=2;
 });
 return s;
}
function resetSearchUI(){
  const results=document.querySelector("#results");
  const status=document.querySelector("#askStatus");
  if(results){results.innerHTML="";results.style.display="none";}
  if(status){status.textContent="";status.className="askStatus";status.removeAttribute("style");}
}

const RB_SYNONYMS={
  "fleet":["fleet service","fleet servicing","clean fleet","dirty fleet","aircraft servicing","latrine","potable water","meals","atgl"],
  "pax":["passenger","passenger service"],
  "passenger":["pax","passenger service"],
  "cargo":["air freight","cargo and mail"],
  "atoc":["air terminal operations center","transportation management"],
  "ji":["joint inspection","joint inspector"],
  "hazmat":["hazardous materials","hazardous material"],
  "kloader":["k-loader","25k","60k","mhe","materials handling equipment"],
  "k-loader":["kloader","25k","60k","mhe","materials handling equipment"],
  "ltc":["load team chief"],
  "load planning":["load plan","load planner","loadplanning"],
  "fleet service":["fleet","aircraft servicing","clean fleet","dirty fleet"],
  "ppe":["personal protective equipment"],
  "personal protective equipment":["ppe"],
  "deviation":["delay code","deviation code","amci 10-2102v6"],
  "bobtail":["prime mover","pintle hook"],
  "warehouse tug":["tug","warehouse tug vehicle"],
  "forklift":["powered industrial truck","fork lift"],
  "belt loader":["baggage conveyor","baggage conveyor belt vehicle","conveyor belt"],
  "stair truck":["staircase truck","step truck"],
  "staircase":["staircase truck","step truck"],
  "halvorsen":["25k","25k loader","kloader","k-loader"],
  "tunner":["60k","60k loader","kloader","k-loader"],
  "60k":["tunner","60k loader"],
  "25k":["halvorsen","25k loader"],
  "af form 1800":["daf form 1800","operator inspection","trouble report","vehicle inspection"],
  "daf form 1800":["af form 1800","operator inspection","trouble report","vehicle inspection"],
  "airfield driving":["flightline driving","af form 483","airfield driver"],
  "leave":["military leave","leaveweb","ptdy","permissive tdy","special pass"],
  "ptdy":["permissive temporary duty","permissive tdy"],
  "quarters":["quarters status","medical quarters"],
  "awards":["award","1206","quarterly award","annual award"],
  "micap":["mission impaired capability awaiting parts","pacer haul","project code 196","rdd 999","amc form 281","amc form 18"],
  "vvip":["very very important parts","rdd 777","project code 196","amc form 281"],
  "pacer haul":["micap","project code 196","rdd 999"],
  "originating log":["daf form 7510","originating amc micap vvip control log"],
  "terminating log":["daf form 7509","terminating amc micap vvip control log"],
  "7510":["originating micap","originating vvip","control log"],
  "7509":["terminating micap","terminating vvip","control log"],
  "tcn":["transportation control number"],
  "c17":["c-17","1c-17a-9"]
};

function normalizeText(s){
  return String(s||"").toLowerCase()
    .replace(/c[\s-]?17a?/g,"c17")
    .replace(/k[\s-]?loader/g,"kloader")
    .replace(/[^\w\s/-]/g," ")
    .replace(/\s+/g," ").trim();
}
function queryTerms(raw){
  const q=normalizeText(raw);
  const set=new Set(q.split(" ").filter(x=>x.length>1));
  Object.entries(RB_SYNONYMS).forEach(([key,vals])=>{
    if(q.includes(normalizeText(key))){
      vals.forEach(v=>normalizeText(v).split(" ").forEach(w=>w.length>1&&set.add(w)));
    }
  });
  return [...set];
}
function coreQueryTerms(raw){
  // Question/helper words should not become required concepts in a regulation search.
  const stop=new Set([
    "the","and","or","for","of","to","in","on","a","an","what","which","is","are","do","does",
    "when","how","who","where","why","can","could","should","would","may","much","many","often","long",
    "tell","show","find","give","need","needs","about"
  ]);
  return normalizeText(raw).split(" ").filter(x=>x.length>1&&!stop.has(x));
}

function nearbySearchContext(index,radius=6){
  const hit=state.fulltext[index];
  if(!hit) return "";
  const parts=[];
  const lo=Math.max(0,index-radius), hi=Math.min(state.fulltext.length-1,index+radius);
  for(let i=lo;i<=hi;i++){
    const c=state.fulltext[i];
    if(c.sourceId!==hit.sourceId) continue;
    if(Math.abs((c.page||0)-(hit.page||0))>1) continue;
    parts.push(c.heading||"",c.text||"");
  }
  return normalizeText(parts.join(" "));
}

function conceptVariants(term){
  const out=new Set([normalizeText(term)]);
  const t=normalizeText(term);

  // Use synonyms as concept-equivalence candidates for coverage, but at lower weight.
  Object.entries(RB_SYNONYMS).forEach(([key,vals])=>{
    const nk=normalizeText(key);
    if(nk===t){
      vals.forEach(v=>out.add(normalizeText(v)));
    }
    vals.forEach(v=>{
      if(normalizeText(v)===t) out.add(nk);
    });
  });

  // Common spelling/format variations.
  if(t==="ppe") out.add("personal protective equipment");
  if(t==="hazmat") out.add("hazardous materials");
  if(t==="ji") out.add("joint inspection");
  if(t==="pax") out.add("passenger");
  if(t==="ptdy") out.add("permissive temporary duty");
  if(t==="atoc") out.add("air terminal operations center");
  if(t==="kloader") out.add("k loader");
  if(t==="c17") out.add("c 17");

  return [...out].filter(Boolean);
}

function conceptMatch(hay,term){
  const variants=conceptVariants(term);
  let exact=false, synonym=false;
  for(const v of variants){
    if(!v) continue;
    if(hay.includes(v)){
      if(v===normalizeText(term)) exact=true;
      else synonym=true;
    }
  }
  return {matched:exact||synonym,exact,synonym};
}

function requirementSignal(text){
  const t=normalizeText(text);
  const signals=[
    " must "," will "," shall "," required "," requirement "," prohibited "," may not ",
    " will not "," ensure "," responsible for "," no later than "," nlt "," within ",
    " at least "," minimum "," maximum "," only "," prior to "," before "," after ",
    " wear "," use "," maintain "," complete "," inspect "," notify "," document "
  ];
  let score=0;
  const padded=" "+t+" ";
  for(const s of signals){
    if(padded.includes(s)) score+=1;
  }
  return Math.min(score,5);
}

function queryHasRequirementIntent(raw){
  const q=" "+normalizeText(raw)+" ";
  const cues=[
    " required "," requirements "," require "," must "," shall "," will "," wear "," allowed ",
    " prohibited "," limitation "," limit "," minimum "," maximum "," deadline "," due ",
    " how often "," frequency "," when "," what ppe "," what equipment "," what documentation ",
    " who "," how "," procedure "," procedures "," steps "," responsibility "," responsibilities "
  ];
  return cues.some(c=>q.includes(c));
}

function fulltextScore(c,raw,terms,coreTerms,context=""){
  const q=normalizeText(raw);
  const text=c.norm||normalizeText(c.text);
  const head=normalizeText(c.heading);
  const src=normalizeText((c.source||"")+" "+(c.subtitle||""));
  const self=text+" "+head+" "+src;
  let s=0;

  // 1) Exact phrase / title alignment.
  if(text.includes(q)) s+=220;
  if(head.includes(q)) s+=260;
  if(src.includes(q)) s+=90;

  // 2) Concept coverage: this is generic for every query, not hard-coded to Fleet/PPE.
  let exactSelf=0, synonymSelf=0, contextOnly=0, covered=0;
  coreTerms.forEach(t=>{
    const selfHit=conceptMatch(self,t);
    const ctxHit=conceptMatch(context,t);

    if(selfHit.exact){
      exactSelf++; covered++; s+=90;
    }else if(selfHit.synonym){
      synonymSelf++; covered++; s+=52;
    }else if(ctxHit.matched){
      contextOnly++; covered++; s+=34;
    }
  });

  if(coreTerms.length>=2){
    // All concepts in the actual paragraph/heading is strongest.
    if(exactSelf+synonymSelf===coreTerms.length){
      s+=620;
      if(exactSelf===coreTerms.length) s+=140;
    }
    // All concepts are in the same nearby regulation section/page.
    else if(covered===coreTerms.length && (exactSelf+synonymSelf)>0){
      s+=480;
    }
    // Strong partial coverage still beats broad synonym noise.
    else if(covered>=Math.ceil(coreTerms.length*.67)){
      s+=180;
    }
  }else if(coreTerms.length===1 && covered===1){
    s+=90;
  }

  // 3) Reward compact co-occurrence in the paragraph itself.
  if(coreTerms.length>=2){
    const positions=[];
    coreTerms.forEach(t=>{
      let best=-1;
      for(const v of conceptVariants(t)){
        const p=text.indexOf(v);
        if(p>=0 && (best<0 || p<best)) best=p;
      }
      if(best>=0) positions.push(best);
    });
    if(positions.length===coreTerms.length){
      const span=Math.max(...positions)-Math.min(...positions);
      if(span<=120) s+=180;
      else if(span<=300) s+=90;
    }
  }

  // 4) Requirement/action-bearing paragraphs are generally more useful for operational searches.
  const req=requirementSignal(text);
  if(req>0 && (exactSelf+synonymSelf)>0){
    s+=req*28;
    if(queryHasRequirementIntent(raw)) s+=110;
  }

  // 5) Expanded synonyms improve recall, but cannot overpower core concept coverage.
  terms.forEach(t=>{
    if(coreTerms.includes(t)) return;
    if(head.includes(t)) s+=7;
    if(src.includes(t)) s+=4;
    const matches=text.split(t).length-1;
    if(matches>0) s+=Math.min(10,matches*2);
  });

  s+=(c.priority||0);
  return s;
}

function escapeRegExp(s){
  return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function activeSearchTerms(){
  const raw=document.querySelector("#search")?.value.trim()||"";
  return coreQueryTerms(raw);
}

function highlightSearchTerms(html,terms=activeSearchTerms()){
  if(!terms?.length) return html;
  let out=html;

  // Highlight the user's literal concepts first. Longest first prevents partial overlap.
  const unique=[...new Set(terms.map(t=>String(t).trim()).filter(Boolean))]
    .sort((a,b)=>b.length-a.length);

  unique.forEach(term=>{
    const rx=new RegExp(`(${escapeRegExp(term)})`,"gi");
    // Avoid matching inside existing tags by splitting HTML into tags/text.
    out=out.split(/(<[^>]+>)/g).map(part=>{
      if(part.startsWith("<")) return part;
      return part.replace(rx,'<mark class="searchHit">$1</mark>');
    }).join("");
  });
  return out;
}

function splitReadableSentences(text){
  const src=String(text||"").trim();
  if(!src) return [];

  // Preserve common numbered/abbreviated regulation constructs while adding visual sentence breaks.
  // This only changes presentation; source wording remains unchanged.
  const sentences=src.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [src];

  // Avoid making tiny fragments into separate lines.
  const merged=[];
  for(const s0 of sentences){
    const s=s0.trim();
    if(!s) continue;
    if(merged.length && s.length<28){
      merged[merged.length-1]+=" "+s;
    }else{
      merged.push(s);
    }
  }
  return merged;
}

function formatRegText(text,highlight=true){
  const raw=String(text||"").trim();
  if(!raw) return "";

  // Keep paragraph/reference number visually separate.
  const m=raw.match(/^((?:[A-Z]\d+|\d+)(?:\.\d+){1,8}\.?)\s+(.*)$/s);
  const paraNum=m?m[1]:"";
  const body=m?m[2]:raw;

  const lines=splitReadableSentences(body);
  const rendered=lines.map((sentence,i)=>{
    const safe=esc(sentence);
    const highlighted=highlight?highlightSearchTerms(safe):safe;
    return `<div class="regSentence${i===0?" firstSentence":""}">${highlighted}</div>`;
  }).join("");

  if(paraNum){
    return `<div class="regParagraph readableParagraph">
      <div class="paraNum">${esc(paraNum)}</div>
      <div class="paraBody readableBody">${rendered}</div>
    </div>`;
  }

  return `<div class="regBullet readableBody">${rendered}</div>`;
}

function getSourceContext(hit, radius=2){
  const idx=state.fulltext.findIndex(x=>x.id===hit.id);
  if(idx<0) return [];
  const out=[];
  for(let i=Math.max(0,idx-radius);i<=Math.min(state.fulltext.length-1,idx+radius);i++){
    const c=state.fulltext[i];
    if(c.sourceId===hit.sourceId && Math.abs((c.page||0)-(hit.page||0))<=1) out.push(c);
  }
  return out;
}

function toggleContext(id){
  const el=document.getElementById("ctx-"+id);
  if(!el) return;
  el.hidden=!el.hidden;
}

function paragraphRef(r){
  const text=String(r?.text||"").trim();
  const heading=String(r?.heading||"").trim();

  // Common Air Force/DTR paragraph structures: 2.134., A3.1.17., III-V-3, etc.
  const candidates=[
    text.match(/^((?:[A-Z]\d+|\d+)(?:\.\d+){1,6}\.?)/),
    heading.match(/^((?:[A-Z]\d+|\d+)(?:\.\d+){1,6}\.?)/),
    text.match(/\b((?:[A-Z]\d+|\d+)(?:\.\d+){1,6}\.)\s/),
    heading.match(/\b((?:[A-Z]\d+|\d+)(?:\.\d+){1,6}\.)\s/)
  ];
  for(const m of candidates){
    if(m && m[1]) return m[1];
  }

  // DTR and appendix-style identifiers when a normal numbered paragraph is unavailable.
  const dtr=(heading+" "+text).match(/\b(?:III|IV|V|VI|VII|VIII|IX|X)(?:-[A-Z])?-\d+(?:-\d+)*\b/i);
  if(dtr) return dtr[0];

  if(heading && !/^(chapter|section|attachment|appendix|table|figure)\b/i.test(heading)){
    return heading.length<=55 ? heading : "See section heading";
  }
  return "See page";
}

function togglePdfPreview(id){
  const wrap=document.getElementById("pdf-"+id);
  const btn=document.getElementById("pdfbtn-"+id);
  if(!wrap) return;
  const willOpen=wrap.hidden;
  wrap.hidden=!willOpen;
  if(btn) btn.textContent=willOpen ? "Hide PDF page" : "View PDF page";
}

function pdfPreview(r,openByDefault=false){
  if(!r.document) return "";
  const src=`${esc(r.document)}#page=${esc(r.page)}&view=FitH`;
  return `<div id="pdf-${esc(r.id)}" class="pdfPreview" ${openByDefault?"":"hidden"}>
    <div class="pdfPreviewHead">
      <div>
        <b>Source page preview</b>
        <small>${esc(r.source)} • Page ${esc(r.page)}</small>
      </div>
      <a href="${esc(r.document)}#page=${esc(r.page)}" target="_blank">Open full PDF ↗</a>
    </div>
    <iframe src="${src}" title="${esc(r.source)} page ${esc(r.page)}"></iframe>
    <div class="pdfFallback">If the inline PDF does not display on your device, use <b>Open full PDF</b>.</div>
  </div>`;
}

function search(preserveFilter=false){
  resetSearchUI();
  const input=document.querySelector("#search");
  const raw=input?input.value.trim():"";
  const box=document.querySelector("#results");
  if(!raw){
    box.style.display="block";
    box.innerHTML='<div class="empty"><b>Type something to search.</b><br><small>Searches the full extracted text of every indexed publication.</small></div>';
    return;
  }

  const terms=queryTerms(raw);
  const coreTerms=coreQueryTerms(raw);
  let hits=state.fulltext.map((c,i)=>{
      const context=nearbySearchContext(i,6);
      return {...c,_score:fulltextScore(c,raw,terms,coreTerms,context)};
    })
    .filter(c=>c._score>0).sort((a,b)=>b._score-a._score);

  const seen=new Set(), dedup=[];
  for(const h of hits){
    const key=h.sourceId+"-"+h.page+"-"+(h.heading||"")+"-"+h.text.slice(0,80);
    if(seen.has(key)) continue;
    seen.add(key); dedup.push(h);
    if(dedup.length>=25) break;
  }

  box.style.display="block";
  if(!dedup.length){
    box.innerHTML=`<div class="empty"><b>No matching publication text found.</b><br><small>No indexed text matched “${esc(raw)}”.</small></div>`;
    return;
  }

  box.innerHTML=`<div class="searchSummary"><b>${dedup.length} top matches</b><span>${state.sources.length} indexed publications</span></div>`+
    dedup.map((r,ri)=>{
      const ctx=getSourceContext(r,2);
      const para=paragraphRef(r);
      const contextHtml=ctx.map(c=>`${c.heading && c.heading!==r.heading ? `<div class="contextHeading">${highlightSearchTerms(esc(c.heading))}</div>`:""}${formatRegText(c.text)}`).join("");
      return `<article class="result regResult">
        <div class="sourceHeader">
          <div>
            <div class="pubName">${esc(r.source)}</div>
            <div class="pubSub">${esc(r.subtitle||"")}</div>
          </div>
          <div class="pageRef">Page ${esc(r.page)}</div>
        </div>

        <div class="referenceStrip">
          <div><span>PARAGRAPH / REFERENCE</span><b>${esc(para)}</b></div>
          <div><span>PUBLICATION DATE</span><b>${esc(r.sourceDate||"—")}</b></div>
          <div><span>PAGE</span><b>${esc(r.page)}</b></div>
        </div>

        ${r.heading?`<div class="regHeading">${highlightSearchTerms(esc(r.heading))}</div>`:""}
        <div class="matchingLabel">MATCHING SOURCE TEXT</div>
        <div class="regBody">${formatRegText(r.text)}</div>

        <div class="regMeta">${esc(r.authority)}${r.legacy?" • VERIFY CURRENT LOCAL/UPDATED GUIDANCE":""}${r.xfa?" • XFA FORM: ADOBE ACROBAT/READER RECOMMENDED":""}</div>

        <div class="regActions">
          ${r.document?`<button id="pdfbtn-${esc(r.id)}" class="pdfPreviewBtn" onclick="togglePdfPreview(${JSON.stringify(r.id)})">${ri===0?"Hide PDF page":"View PDF page"}</button>`:""}
          ${r.document?`<a class="pdfAction" href="${esc(r.document)}#page=${esc(r.page)}" target="_blank">Open PDF</a>`:""}
          <button onclick="toggleContext(${JSON.stringify(r.id)})">Surrounding text</button>
        </div>

        ${pdfPreview(r,ri===0)}

        <div id="ctx-${esc(r.id)}" class="sourceContext" hidden>
          <div class="contextTitle">Surrounding regulation text</div>
          ${contextHtml}
        </div>
      </article>`;
    }).join("");
}
function setFilter(btn,val){
  document.querySelectorAll(".filter").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  state.filter=val;
  if(document.querySelector("#search").value.trim()) search(true);
}
function toggleFav(id){state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];localStorage.setItem("rbv3_favs",JSON.stringify(state.favorites));renderFavs();if(document.querySelector("#results").style.display==="block")search();}
function renderFavs(){const rows=state.favorites.map(id=>all().find(r=>r.id===id)).filter(Boolean);document.querySelector("#favoriteList").innerHTML=rows.length?rows.map(r=>`<div class="favrow"><b>${esc(r.title)}</b><small>${esc(r.source)} • ¶ ${esc(r.paragraph)}</small><button class="primary" style="margin-top:9px" onclick="quick(${JSON.stringify(r.title)})">Search this</button></div>`).join(""):`<div class="empty">No favorites saved yet.</div>`}
function addResource(){const title=document.querySelector("#rTitle").value.trim(),category=document.querySelector("#rCategory").value,answer=document.querySelector("#rAnswer").value.trim(),ref=document.querySelector("#rRef").value.trim();if(!title||!answer){alert("Enter a title and answer.");return}const id="local-"+Date.now();state.custom.unshift({id,title,question:title,category,source:"Local Resource",sourceDate:"Local",authority:"Local Policy",paragraph:"Local",page:"Local",answer,keywords:[title,category,ref],document:"#"});localStorage.setItem("rbv3_custom",JSON.stringify(state.custom));document.querySelector("#rTitle").value="";document.querySelector("#rAnswer").value="";document.querySelector("#rRef").value="";renderCustom();}
function renderCustom(){const box=document.querySelector("#custom");if(!box)return;box.innerHTML=state.custom.length?state.custom.map((r,i)=>`<div class="favrow"><b>${esc(r.title)}</b><small>${esc(r.category)} • Local Policy</small><button class="primary" style="margin-top:9px;background:#8d3030" onclick="delCustom(${i})">Delete</button></div>`).join(""):`<div class="empty">No local resources added on this device yet.</div>`}
function delCustom(i){state.custom.splice(i,1);localStorage.setItem("rbv3_custom",JSON.stringify(state.custom));renderCustom();}
function go(btn){document.querySelectorAll(".navBtn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");goPage(btn.dataset.page)}
function goPage(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.querySelector("#"+id).classList.add("active")}
document.addEventListener("keydown",e=>{
  if(e.key==="Enter" && document.activeElement.id==="search"){
    e.preventDefault();
    search();
  }
  if(e.key==="Enter" && document.activeElement.id==="aiChatInput" && !e.shiftKey){
    e.preventDefault();
    sendAIChat(e);
  }
});

function setMode(mode){
  state.mode=mode;
}
function runMainAction(){search();}

const AI_CHAT_STORAGE_KEY="resourceBankAIConversationV1";
const AI_CHAT_MAX_MESSAGES=20;
const AI_HISTORY_MAX_MESSAGES=8;
const AI_REQUEST_TIMEOUT_MS=45000;
let askRequestId=0;
let activeAskController=null;
let aiConversation=loadAIConversation();

function loadAIConversation(){
  try{
    const saved=JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY)||"[]");
    if(!Array.isArray(saved)) return [];
    return saved.filter(m=>m && (m.role==="user"||m.role==="assistant") && typeof m.content==="string")
      .slice(-AI_CHAT_MAX_MESSAGES);
  }catch(e){return [];}
}
function saveAIConversation(){
  aiConversation=aiConversation.slice(-AI_CHAT_MAX_MESSAGES);
  localStorage.setItem(AI_CHAT_STORAGE_KEY,JSON.stringify(aiConversation));
}
function recentAIHistory(){
  return aiConversation.slice(-AI_HISTORY_MAX_MESSAGES).map(m=>({role:m.role,content:String(m.content||"").slice(0,6000)}));
}
function retrievalQueryForAI(question,history){
  const normalized=normalizeText(question);
  const concepts=coreQueryTerms(question);
  const contextual=/^(what|how)\s+about\b|^(and|also)\b|\b(it|that|those|they|them|these|he|she)\b/.test(normalized) || concepts.length<=3;
  if(!contextual) return question;
  const prior=[...(history||[])].reverse().find(m=>m.role==="user" && String(m.content||"").trim());
  return prior ? `${String(prior.content).slice(0,1200)}\nFollow-up: ${question}` : question;
}
function aiCitationsHtml(sources){
  const sourceList=sources||[];
  const citations=sourceList.map((s,i)=>`
    <div class="citationCard">
      <b>[${i+1}] ${esc(s.source)}</b>
      <small>${esc(s.authority||"")} • ${esc(s.sourceDate||"")}<br>
      Paragraph ${esc(s.paragraph||"—")} • Page ${esc(s.page||"—")}<br>${esc(s.title||"")}</small>
    </div>`).join("");
  return `<details class="aiSources"><summary>Sources and references (${sourceList.length})</summary>${citations||"<div class='empty'>No supporting source returned.</div>"}</details>`;
}
function renderAIConversation(loading=false){
  const wrap=document.querySelector("#aiConversation");
  const box=document.querySelector("#aiAnswer");
  if(!wrap||!box) return;
  const messages=aiConversation.map(m=>`
    <div class="aiMessage ${m.role}${m.error?" error":""}">
      <div class="aiMessageLabel">${m.role==="user"?"You":"Resource Bank AI"}</div>
      <div class="aiBubble">${esc(m.content)}</div>
      ${m.role==="assistant"?aiCitationsHtml(m.sources||[]):""}
    </div>`).join("");
  const loadingHtml=loading?`<div class="aiMessage assistant" data-ai-loading="true"><div class="aiMessageLabel">Resource Bank AI</div><div class="aiBubble"><span class="aiLoadingDots" aria-label="Searching approved Resource Bank sources and formulating an answer"><i></i><i></i><i></i></span></div></div>`:"";
  const emptyHtml=!messages&&!loading?`<div class="aiEmptyState"><strong>What can I help you with?</strong><span>Ask about an Air Transportation requirement, then continue naturally with follow-up questions. Answers stay grounded in the Resource Bank sources.</span></div>`:"";
  box.innerHTML=messages+loadingHtml+emptyHtml;
  wrap.classList.add("visible");
  requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight;});
}
function newAIChat(){
  askRequestId++;
  if(activeAskController) activeAskController.abort();
  activeAskController=null;
  aiConversation=[];
  localStorage.removeItem(AI_CHAT_STORAGE_KEY);
  renderAIConversation(false);
  const status=document.querySelector("#askStatus");
  if(status){status.textContent="";status.className="askStatus";}
  const input=document.querySelector("#aiChatInput");
  if(input){input.value="";input.focus();}
  const send=document.querySelector("#aiSendBtn");
  if(send) send.disabled=false;
}

function isAfi24605Source(source){
  const normalized=normalizeText(`${source?.sourceId||""} ${source?.source||""} ${source?.subtitle||""}`)
    .replace(/\s+/g,"");
  return normalized.includes("afi24-605") || normalized.includes("dafi24-605") || normalized.includes("dafi24605");
}

function retrieveOfficialSourcesForAI(raw,limit=14){
  const terms=queryTerms(raw);
  const coreTerms=coreQueryTerms(raw);
  const scored=state.fulltext.map((c,i)=>{
      if(c.local || c.restricted) return {...c,_score:0};
      const context=nearbySearchContext(i,6);
      return {...c,_score:fulltextScore(c,raw,terms,coreTerms,context)};
    });
  const strongestScore=scored.reduce((best,c)=>Math.max(best,c._score),0);
  const afiPriorityFloor=Math.max(180,strongestScore*.45);
  const hits=scored.map(c=>{
      // DAFI/AFI 24-605 is the primary Air Transportation instruction. Prefer its
      // strong Ask AI matches, without promoting incidental matches for unrelated questions.
      const sourcePriority=c._score>=afiPriorityFloor && isAfi24605Source(c) ? 1800 : 0;
      return {...c,_score:c._score+sourcePriority};
    })
    .filter(c=>c._score>0)
    .sort((a,b)=>b._score-a._score);

  const seen=new Set(), out=[];
  for(const r of hits){
    const key=[r.sourceId,r.page,r.heading||"",String(r.text||"").slice(0,100)].join("|");
    if(seen.has(key)) continue;
    seen.add(key);
    out.push({
      id:r.id,
      source:r.source,
      subtitle:r.subtitle||"",
      sourceDate:r.sourceDate||"",
      authority:r.authority||"",
      page:r.page,
      paragraph:paragraphRef(r),
      heading:r.heading||"",
      text:String(r.text||"").slice(0,7000)
    });
    if(out.length>=limit) break;
  }
  return out;
}

async function askResourceBank(){
  const input=document.querySelector("#aiChatInput");
  const question=input.value.trim();
  const status=document.querySelector("#askStatus");
  const send=document.querySelector("#aiSendBtn");
  const requestId=++askRequestId;

  status.textContent="";
  status.className="askStatus";

  if(!question){
    status.className="askStatus error";
    status.textContent="Enter a question first.";
    return;
  }

  const history=recentAIHistory();
  aiConversation.push({role:"user",content:question});
  saveAIConversation();
  input.value="";
  input.focus();
  if(send) send.disabled=true;
  status.textContent="";
  status.className="askStatus";
  renderAIConversation(true);

  if(activeAskController) activeAskController.abort();
  const controller=new AbortController();
  activeAskController=controller;
  const timeoutId=setTimeout(()=>controller.abort(),AI_REQUEST_TIMEOUT_MS);

  try{
    const retrievalQuery=retrievalQueryForAI(question,history);
    const res=await fetch("/api/ask",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      signal:controller.signal,
      body:JSON.stringify({question,history,sources:retrieveOfficialSourcesForAI(retrievalQuery,8),localResources:getLocalKnowledge().slice(0,12)})
    });
    const data=await res.json();
    if(requestId!==askRequestId) return;
    if(!res.ok) throw new Error(data.error||"Unable to generate an answer.");

    aiConversation.push({role:"assistant",content:String(data.answer||""),sources:data.sources||[],sourceCount:data.sourceCount||0});
    saveAIConversation();
    renderAIConversation(false);
  }catch(err){
    if(requestId!==askRequestId) return;
    const message=err?.name==="AbortError"
      ? "The AI request took too long. Please try again."
      : String(err.message||"AI request failed.");
    aiConversation.push({role:"assistant",content:message,sources:[],error:true});
    saveAIConversation();
    renderAIConversation(false);
  }finally{
    clearTimeout(timeoutId);
    if(activeAskController===controller) activeAskController=null;
    if(requestId===askRequestId){
      if(send) send.disabled=false;
      input.focus();
    }
  }
}

function sendAIChat(event){
  event?.preventDefault?.();
  if(activeAskController) return;
  askResourceBank();
}


let liveSearchTimer=null;
function installSearchEvents(){ /* simplified button-driven search */ }


function runSearchSelfTest(){
  const tests=["fleet","fleet service","dirty fleet","potable water","load planning","joint inspector","c17 winch","hazmat training","deviation code","bullet statements","fitness"];
  const report=tests.map(q=>{
    const terms=queryTerms(q);
    const coreTerms=coreQueryTerms(q);
    const best=state.fulltext.reduce((top,c)=>{
      const score=fulltextScore(c,q,terms,coreTerms,"");
      return !top||score>top._score?{...c,_score:score}:top;
    },null);
    return `${q}: ${best&&best._score>0 ? "PASS — "+best.source+" p."+best.page+" "+(best.heading||"") : "FAIL"}`;
  });
  alert(report.join("\n"));
}

renderAIConversation(false);
load();
installSearchEvents();

function setActiveNav(name){
  document.querySelectorAll(".navItem").forEach(b=>b.classList.remove("active"));
  const id=name==="search"?"#navSearch":name==="ai"?"#navAI":name==="add"?"#navAdd":name==="training"?"#navTraining":name==="appointments"?"#navAppointments":name==="readfile"?"#navReadFile":"#navSettings";
  document.querySelector(id)?.classList.add("active");
}
function showAIChat(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#aiChatPage").classList.add("active");
  setActiveNav("ai");
  renderAIConversation(Boolean(activeAskController));
  requestAnimationFrame(()=>document.querySelector("#aiChatInput")?.focus());
  window.scrollTo(0,0);
}
function showSettings(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#settings").classList.add("active");
  setActiveNav("settings");
  window.scrollTo(0,0);
}
function showHome(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#home").classList.add("active");
  setActiveNav("search");
  window.scrollTo(0,0);
}
function showAddResource(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#addResourcePage").classList.add("active");
  setActiveNav("add");
  renderLocalKnowledge();
  window.scrollTo(0,0);
}
function showTraining(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#trainingPage").classList.add("active");
  setActiveNav("training");
  window.scrollTo(0,0);
}
function showAppointments(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#appointmentPage").classList.add("active");
  setActiveNav("appointments");
  renderAppointmentLetters();
  window.scrollTo(0,0);
}
function showReadFile(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelector("#readFilePage").classList.add("active");
  setActiveNav("readfile");
  renderATOCReadFile();
  window.scrollTo(0,0);
}
function clearMainSearch(){const i=document.querySelector("#search");i.value="";resetSearchUI();i.focus();}
function runDirectSearch(){state.mode="search";search();}
function runDirectAI(){showAIChat();}
function exampleSearch(q){document.querySelector("#search").value=q;runDirectSearch();}


const LOCAL_KNOWLEDGE_KEY="resourceBankLocalKnowledgeV1";

function getLocalKnowledge(){
  try{
    return JSON.parse(localStorage.getItem(LOCAL_KNOWLEDGE_KEY)||"[]");
  }catch(e){
    return [];
  }
}

function persistLocalKnowledge(items){
  localStorage.setItem(LOCAL_KNOWLEDGE_KEY,JSON.stringify(items));
}

function localEntryToSearchBlock(item){
  return {
    id:"local-"+item.id,
    sourceId:"local-resource",
    source:item.title || "Local Resource",
    subtitle:item.category || "Local Work-Center Resource",
    sourceDate:item.effectiveDate || item.addedDate || "Local",
    authority:"Local Resource",
    restricted:false,
    legacy:item.status==="Superseded" || item.status==="Archived",
    priority:20,
    local:true,
    status:item.status||"Approved",
    page:1,
    heading:item.reference || item.category || "Local Resource",
    text:item.text || "",
    document:""
  };
}

function mergeLocalKnowledgeIntoSearch(){
  const local=getLocalKnowledge();
  state.fulltext=(state.fulltext||[]).filter(x=>!x.local);
  state.fulltext.push(...local.map(localEntryToSearchBlock));
}

function saveLocalKnowledge(){
  const title=document.querySelector("#localTitle")?.value.trim();
  const category=document.querySelector("#localCategory")?.value.trim();
  const effectiveDate=document.querySelector("#localEffectiveDate")?.value;
  const status=document.querySelector("#localStatus")?.value || "Approved";
  const reference=document.querySelector("#localReference")?.value.trim();
  const text=document.querySelector("#localText")?.value.trim();
  const statusEl=document.querySelector("#localSaveStatus");

  if(!title || !text){
    if(statusEl){
      statusEl.textContent="Title and policy/guidance text are required.";
      statusEl.className="localSaveStatus error";
    }
    return;
  }

  const items=getLocalKnowledge();
  const now=new Date();
  items.unshift({
    id:String(Date.now()),
    title,category,effectiveDate,status,reference,text,
    addedDate:now.toISOString().slice(0,10),
    updatedAt:now.toISOString()
  });
  persistLocalKnowledge(items);
  addToATOCReadFile(items[0]);
  mergeLocalKnowledgeIntoSearch();

  ["#localTitle","#localCategory","#localEffectiveDate","#localReference","#localText"].forEach(sel=>{
    const el=document.querySelector(sel);
    if(el) el.value="";
  });
  document.querySelector("#localStatus").value="Approved";

  if(statusEl){
    statusEl.textContent="Saved. This resource is now searchable.";
    statusEl.className="localSaveStatus success";
  }
  renderLocalKnowledge();
}

function deleteLocalKnowledge(id){
  if(!confirm("Delete this local resource?")) return;
  const items=getLocalKnowledge().filter(x=>x.id!==id);
  persistLocalKnowledge(items);
  mergeLocalKnowledgeIntoSearch();
  renderLocalKnowledge();
}

function editLocalKnowledge(id){
  const item=getLocalKnowledge().find(x=>x.id===id);
  if(!item) return;
  document.querySelector("#localTitle").value=item.title||"";
  document.querySelector("#localCategory").value=item.category||"";
  document.querySelector("#localEffectiveDate").value=item.effectiveDate||"";
  document.querySelector("#localStatus").value=item.status||"Approved";
  document.querySelector("#localReference").value=item.reference||"";
  document.querySelector("#localText").value=item.text||"";
  deleteLocalKnowledge(id);
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderLocalKnowledge(){
  const items=getLocalKnowledge();
  const list=document.querySelector("#localResourceList");
  const count=document.querySelector("#localCount");
  if(count) count.textContent=items.length;
  if(!list) return;

  if(!items.length){
    list.innerHTML='<div class="empty">No local resources saved yet.</div>';
    return;
  }

  list.innerHTML=items.map(item=>`
    <div class="localResourceCard">
      <div class="localResourceHead">
        <div>
          <b>${esc(item.title)}</b>
          <small>${esc(item.category||"Uncategorized")} • ${esc(item.status||"Approved")}${item.sourceType?" • "+esc(item.sourceType):""}</small>
        </div>
        <span>${esc(item.effectiveDate||item.addedDate||"")}</span>
      </div>
      ${item.reference?`<div class="localRef">${esc(item.reference)}</div>`:""}
      <div class="localSnippet">${esc((item.text||"").slice(0,260))}${(item.text||"").length>260?"…":""}</div>
      <div class="localActions">
        <button onclick="editLocalKnowledge(${JSON.stringify(item.id)})">Edit</button>
        <button class="dangerAction" onclick="deleteLocalKnowledge(${JSON.stringify(item.id)})">Delete</button>
      </div>
    </div>
  `).join("");
}

function exportLocalKnowledge(){
  const data={
    resourceBankExportVersion:1,
    exportedAt:new Date().toISOString(),
    resources:getLocalKnowledge()
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="resource-bank-local-resources.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importLocalKnowledge(event){
  const file=event.target.files?.[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const incoming=Array.isArray(parsed)?parsed:(parsed.resources||[]);
      if(!Array.isArray(incoming)) throw new Error("Invalid format");
      const current=getLocalKnowledge();
      const map=new Map(current.map(x=>[x.id,x]));
      incoming.forEach((x,i)=>{
        const id=x.id || "import-"+Date.now()+"-"+i;
        map.set(id,{...x,id});
      });
      persistLocalKnowledge([...map.values()]);
      mergeLocalKnowledgeIntoSearch();
      renderLocalKnowledge();
      alert(`Imported ${incoming.length} local resource${incoming.length===1?"":"s"}.`);
    }catch(e){
      alert("Could not import this Resource Bank backup.");
    }
    event.target.value="";
  };
  reader.readAsText(file);
}



async function decipherWorkCenterEmail(){
  const raw=document.querySelector("#emailPaste")?.value.trim();
  const status=document.querySelector("#emailParseStatus");
  const btn=document.querySelector("#decipherBtn");

  if(!raw){
    if(status){
      status.textContent="Paste the email or message first.";
      status.className="localSaveStatus error";
    }
    return;
  }

  if(status){
    status.textContent="Reading the message and organizing the work-center change…";
    status.className="localSaveStatus working";
  }
  if(btn){ btn.disabled=true; btn.textContent="Deciphering…"; }

  try{
    const res=await fetch("/api/parse-resource",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text:raw})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data?.error||"Unable to decipher this message.");

    const x=data.extracted||{};
    document.querySelector("#emailTitle").value=x.title||"";
    document.querySelector("#emailCategory").value=x.category||"";
    document.querySelector("#emailEffectiveDate").value=x.effectiveDate||"";
    document.querySelector("#emailReviewDate").value=x.reviewDate||"";
    document.querySelector("#emailReference").value=x.reference||"";
    document.querySelector("#emailSummary").value=x.summary||"";
    document.querySelector("#emailActions").value=Array.isArray(x.actions)?x.actions.join("\n"):x.actions||"";
    document.querySelector("#emailDeadlines").value=Array.isArray(x.deadlines)?x.deadlines.join("\n"):x.deadlines||"";
    document.querySelector("#emailPoc").value=Array.isArray(x.pocs)?x.pocs.join("\n"):x.pocs||"";
    document.querySelector("#emailCleanText").value=x.cleanText||"";

    document.querySelector("#emailReview").hidden=false;
    if(status){
      status.textContent="Extracted. Review the information below before submitting.";
      status.className="localSaveStatus success";
    }
    setTimeout(()=>document.querySelector("#emailReview")?.scrollIntoView({behavior:"smooth",block:"start"}),100);
  }catch(err){
    if(status){
      status.textContent=err.message||"Unable to decipher the message.";
      status.className="localSaveStatus error";
    }
  }finally{
    if(btn){ btn.disabled=false; btn.textContent="✦ Decipher Email"; }
  }
}

function cancelEmailReview(){
  const review=document.querySelector("#emailReview");
  if(review) review.hidden=true;
  const status=document.querySelector("#emailParseStatus");
  if(status){
    status.textContent="Review cancelled. The pasted message has not been saved.";
    status.className="localSaveStatus";
  }
}

function submitParsedEmailResource(){
  const title=document.querySelector("#emailTitle")?.value.trim();
  const category=document.querySelector("#emailCategory")?.value.trim();
  const effectiveDate=document.querySelector("#emailEffectiveDate")?.value;
  const reviewDate=document.querySelector("#emailReviewDate")?.value;
  const reference=document.querySelector("#emailReference")?.value.trim();
  const summary=document.querySelector("#emailSummary")?.value.trim();
  const actions=document.querySelector("#emailActions")?.value.trim();
  const deadlines=document.querySelector("#emailDeadlines")?.value.trim();
  const pocs=document.querySelector("#emailPoc")?.value.trim();
  const cleanText=document.querySelector("#emailCleanText")?.value.trim();
  const originalEmail=document.querySelector("#emailPaste")?.value.trim();
  const statusEl=document.querySelector("#emailParseStatus");

  if(!title || !cleanText){
    if(statusEl){
      statusEl.textContent="Resource title and searchable resource text are required.";
      statusEl.className="localSaveStatus error";
    }
    return;
  }

  const parts=[];
  if(summary) parts.push("WHAT CHANGED\n"+summary);
  if(actions) parts.push("REQUIRED ACTIONS\n"+actions);
  if(deadlines) parts.push("DEADLINES / SUSPENSES\n"+deadlines);
  if(pocs) parts.push("POC / CONTACT\n"+pocs);
  if(cleanText) parts.push("RESOURCE DETAILS\n"+cleanText);

  const items=getLocalKnowledge();
  const now=new Date();
  items.unshift({
    id:String(Date.now()),
    title,
    category,
    effectiveDate,
    reviewDate,
    status:"Approved",
    reference,
    summary,
    text:parts.join("\n\n"),
    originalSourceText:originalEmail,
    sourceType:"Email / Work Center Update",
    addedDate:now.toISOString().slice(0,10),
    updatedAt:now.toISOString()
  });
  persistLocalKnowledge(items);
  addToATOCReadFile(items[0]);
  mergeLocalKnowledgeIntoSearch();
  renderLocalKnowledge();

  ["#emailPaste","#emailTitle","#emailCategory","#emailEffectiveDate","#emailReviewDate",
   "#emailReference","#emailSummary","#emailActions","#emailDeadlines","#emailPoc","#emailCleanText"]
    .forEach(sel=>{
      const el=document.querySelector(sel);
      if(el) el.value="";
    });

  document.querySelector("#emailReview").hidden=true;
  if(statusEl){
    statusEl.textContent="Submitted. The work-center update is now searchable in Resource Bank.";
    statusEl.className="localSaveStatus success";
  }
}




const ATOC_READ_FILE_KEY="resourceBankATOCReadFileV1";

function getATOCReadFile(){
  try{
    return JSON.parse(localStorage.getItem(ATOC_READ_FILE_KEY)||"[]");
  }catch(e){
    return [];
  }
}

function persistATOCReadFile(items){
  localStorage.setItem(ATOC_READ_FILE_KEY,JSON.stringify(items));
}

function addToATOCReadFile(item){
  const history=getATOCReadFile();
  const submittedAt=new Date().toISOString();
  history.unshift({
    historyId:"rf-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
    resourceId:item.id,
    title:item.title||"Local Resource",
    category:item.category||"Uncategorized",
    effectiveDate:item.effectiveDate||"",
    reviewDate:item.reviewDate||"",
    reference:item.reference||"",
    status:item.status||"Approved",
    sourceType:item.sourceType||"Manual Resource Entry",
    summary:item.summary||"",
    text:item.text||"",
    originalSourceText:item.originalSourceText||"",
    submittedAt,
    submittedDate:submittedAt.slice(0,10)
  });
  persistATOCReadFile(history);
}

function toggleReadFileEntry(id){
  const el=document.getElementById("rf-"+id);
  if(el) el.hidden=!el.hidden;
}

function renderATOCReadFile(){
  const items=getATOCReadFile();
  const list=document.querySelector("#readFileList");
  const count=document.querySelector("#readFileCount");
  if(count) count.textContent=items.length;
  if(!list) return;

  if(!items.length){
    list.innerHTML='<div class="empty">No submissions have been added to the ATOC Read File yet.</div>';
    return;
  }

  list.innerHTML=items.map(item=>`
    <article class="readFileCard">
      <button class="readFileSummary" onclick="toggleReadFileEntry(${JSON.stringify(item.historyId)})">
        <div class="readFileMain">
          <div class="readFileTitle">${esc(item.title)}</div>
          <div class="readFileMeta">${esc(item.category)} • ${esc(item.sourceType)} • ${esc(item.status)}</div>
        </div>
        <div class="readFileDates">
          <span>Submitted ${esc(item.submittedDate||"")}</span>
          ${item.effectiveDate?`<span>Effective ${esc(item.effectiveDate)}</span>`:""}
        </div>
      </button>

      <div id="rf-${esc(item.historyId)}" class="readFileDetail" hidden>
        <div class="referenceStrip readFileReferenceStrip">
          <div><span>REFERENCE / SOURCE</span><b>${esc(item.reference||"—")}</b></div>
          <div><span>EFFECTIVE DATE</span><b>${esc(item.effectiveDate||"—")}</b></div>
          <div><span>SUBMITTED</span><b>${esc(item.submittedDate||"—")}</b></div>
        </div>

        ${item.reviewDate?`<div class="readFileField"><span>REVIEW / EXPIRATION DATE</span><p>${esc(item.reviewDate)}</p></div>`:""}
        ${item.summary?`<div class="readFileField"><span>SUMMARY</span><p>${esc(item.summary)}</p></div>`:""}

        <div class="readFileField">
          <span>SUBMITTED RESOURCE TEXT</span>
          <pre>${esc(item.text||"")}</pre>
        </div>

        ${item.originalSourceText?`
        <div class="readFileField originalEmailField">
          <span>ORIGINAL PASTED EMAIL / MESSAGE</span>
          <pre>${esc(item.originalSourceText)}</pre>
        </div>`:""}
      </div>
    </article>
  `).join("");
}



const APPOINTMENT_LETTER_KEY="resourceBankAppointmentLettersV1";
const APPOINTMENT_DB_NAME="resourceBankFilesV1";
const APPOINTMENT_DB_STORE="appointmentFiles";

function getAppointmentLetters(){
  try{
    return JSON.parse(localStorage.getItem(APPOINTMENT_LETTER_KEY)||"[]");
  }catch(e){
    return [];
  }
}

function persistAppointmentLetters(items){
  localStorage.setItem(APPOINTMENT_LETTER_KEY,JSON.stringify(items));
}

function openAppointmentDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(APPOINTMENT_DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(APPOINTMENT_DB_STORE)){
        db.createObjectStore(APPOINTMENT_DB_STORE);
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

async function saveAppointmentFile(id,file){
  if(!file) return;
  const db=await openAppointmentDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(APPOINTMENT_DB_STORE,"readwrite");
    tx.objectStore(APPOINTMENT_DB_STORE).put(file,id);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
  db.close();
}

async function getAppointmentFile(id){
  const db=await openAppointmentDB();
  const result=await new Promise((resolve,reject)=>{
    const tx=db.transaction(APPOINTMENT_DB_STORE,"readonly");
    const req=tx.objectStore(APPOINTMENT_DB_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });
  db.close();
  return result;
}

async function deleteAppointmentFile(id){
  const db=await openAppointmentDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(APPOINTMENT_DB_STORE,"readwrite");
    tx.objectStore(APPOINTMENT_DB_STORE).delete(id);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
  db.close();
}

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const value=String(reader.result||"");
      resolve(value.includes(",")?value.split(",")[1]:value);
    };
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function appointmentStatus(expirationDate,expirationBasis){
  if(!expirationDate){
    const basis=String(expirationBasis||"").toLowerCase();
    if(basis.includes("until superseded") || basis.includes("until rescinded") || basis.includes("no expiration")){
      return {key:"current",label:"Current — No Calendar Expiration",days:null,sort:999999};
    }
    return {key:"unknown",label:"Expiration Not Identified",days:null,sort:888888};
  }

  const today=new Date();
  today.setHours(0,0,0,0);
  const exp=new Date(expirationDate+"T00:00:00");
  const days=Math.ceil((exp-today)/(1000*60*60*24));

  if(days<0) return {key:"expired",label:`Expired ${Math.abs(days)} day${Math.abs(days)===1?"":"s"} ago`,days,sort:days};
  if(days===0) return {key:"expired",label:"Expires Today",days,sort:days};
  if(days<=30) return {key:"due30",label:`Expires in ${days} day${days===1?"":"s"}`,days,sort:days};
  if(days<=60) return {key:"due60",label:`Expires in ${days} days`,days,sort:days};
  if(days<=90) return {key:"due90",label:`Expires in ${days} days`,days,sort:days};
  return {key:"current",label:`Current • ${days} days remaining`,days,sort:days};
}

async function analyzeAppointmentLetter(){
  const file=document.querySelector("#appointmentFile")?.files?.[0]||null;
  const pasted=document.querySelector("#appointmentPaste")?.value.trim()||"";
  const status=document.querySelector("#appointmentAnalyzeStatus");
  const btn=document.querySelector("#analyzeAppointmentBtn");

  if(!file && !pasted){
    status.textContent="Upload a PDF/TXT appointment letter or paste the letter text.";
    status.className="localSaveStatus error";
    return;
  }

  if(file && file.size>4*1024*1024){
    status.textContent="Please use an appointment letter smaller than 4 MB.";
    status.className="localSaveStatus error";
    return;
  }

  status.textContent="Reading the appointment letter and checking expiration information…";
  status.className="localSaveStatus working";
  btn.disabled=true;
  btn.textContent="Analyzing…";

  try{
    const payload={text:pasted};
    if(file){
      payload.fileName=file.name;
      payload.mimeType=file.type||"application/pdf";
      payload.fileData=await fileToBase64(file);
    }

    const res=await fetch("/api/parse-appointment",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data?.error||"Unable to analyze this appointment letter.");

    const x=data.extracted||{};
    document.querySelector("#apptTitle").value=x.title||file?.name?.replace(/\.[^.]+$/,"")||"";
    document.querySelector("#apptCategory").value=x.category||"";
    document.querySelector("#apptMembers").value=Array.isArray(x.members)?x.members.join("\n"):x.members||"";
    document.querySelector("#apptRole").value=x.role||"";
    document.querySelector("#apptEffectiveDate").value=x.effectiveDate||"";
    document.querySelector("#apptExpirationDate").value=x.expirationDate||"";
    document.querySelector("#apptExpirationBasis").value=x.expirationBasis||"";
    document.querySelector("#apptReference").value=x.reference||"";
    document.querySelector("#apptSummary").value=x.summary||"";

    document.querySelector("#appointmentReview").hidden=false;
    status.textContent="Detected. Review the appointment information before saving.";
    status.className="localSaveStatus success";
    setTimeout(()=>document.querySelector("#appointmentReview")?.scrollIntoView({behavior:"smooth",block:"start"}),100);
  }catch(err){
    status.textContent=err.message||"Unable to analyze the appointment letter.";
    status.className="localSaveStatus error";
  }finally{
    btn.disabled=false;
    btn.textContent="✦ Analyze Appointment Letter";
  }
}

function cancelAppointmentReview(){
  document.querySelector("#appointmentReview").hidden=true;
  const status=document.querySelector("#appointmentAnalyzeStatus");
  status.textContent="Review cancelled. The letter has not been saved.";
  status.className="localSaveStatus";
}

async function saveAppointmentLetter(){
  const title=document.querySelector("#apptTitle")?.value.trim();
  const category=document.querySelector("#apptCategory")?.value.trim();
  const members=document.querySelector("#apptMembers")?.value.trim();
  const role=document.querySelector("#apptRole")?.value.trim();
  const effectiveDate=document.querySelector("#apptEffectiveDate")?.value||"";
  const expirationDate=document.querySelector("#apptExpirationDate")?.value||"";
  const expirationBasis=document.querySelector("#apptExpirationBasis")?.value.trim();
  const reference=document.querySelector("#apptReference")?.value.trim();
  const summary=document.querySelector("#apptSummary")?.value.trim();
  const file=document.querySelector("#appointmentFile")?.files?.[0]||null;
  const pasted=document.querySelector("#appointmentPaste")?.value.trim()||"";
  const statusEl=document.querySelector("#appointmentAnalyzeStatus");

  if(!title){
    statusEl.textContent="Letter title is required.";
    statusEl.className="localSaveStatus error";
    return;
  }

  const now=new Date();
  const id="appt-"+Date.now();
  const item={
    id,title,category,members,role,effectiveDate,expirationDate,expirationBasis,reference,summary,
    fileName:file?.name||"",
    fileType:file?.type||"",
    hasFile:!!file,
    pastedText:pasted,
    addedDate:now.toISOString().slice(0,10),
    addedAt:now.toISOString()
  };

  const items=getAppointmentLetters();
  items.unshift(item);
  persistAppointmentLetters(items);

  if(file){
    try{ await saveAppointmentFile(id,file); }catch(e){}
  }

  // Add a read-file history record as an administrative submission.
  const readText=[
    members?`APPOINTED MEMBER(S)\n${members}`:"",
    role?`APPOINTMENT / ROLE\n${role}`:"",
    effectiveDate?`EFFECTIVE DATE\n${effectiveDate}`:"",
    expirationDate?`EXPIRATION DATE\n${expirationDate}`:"",
    expirationBasis?`EXPIRATION BASIS\n${expirationBasis}`:"",
    summary?`NOTES / REQUIREMENTS\n${summary}`:""
  ].filter(Boolean).join("\n\n");

  addToATOCReadFile({
    id,
    title,
    category:category||"Appointment Letters",
    effectiveDate,
    reviewDate:expirationDate,
    reference,
    status:"Approved",
    sourceType:"Appointment Letter",
    summary,
    text:readText,
    originalSourceText:pasted
  });

  ["#appointmentPaste","#apptTitle","#apptCategory","#apptMembers","#apptRole","#apptEffectiveDate",
   "#apptExpirationDate","#apptExpirationBasis","#apptReference","#apptSummary"].forEach(sel=>{
    const el=document.querySelector(sel);
    if(el) el.value="";
  });
  const fileInput=document.querySelector("#appointmentFile");
  if(fileInput) fileInput.value="";
  document.querySelector("#appointmentReview").hidden=true;

  statusEl.textContent="Saved. Resource Bank is now tracking this appointment letter.";
  statusEl.className="localSaveStatus success";
  renderAppointmentLetters();
}

async function openAppointmentFile(id){
  try{
    const file=await getAppointmentFile(id);
    if(!file){
      alert("The original file is not stored on this browser/device.");
      return;
    }
    const url=URL.createObjectURL(file);
    window.open(url,"_blank");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){
    alert("Unable to open the stored appointment letter.");
  }
}

async function deleteAppointmentLetter(id){
  if(!confirm("Delete this appointment letter from the tracker?")) return;
  persistAppointmentLetters(getAppointmentLetters().filter(x=>x.id!==id));
  try{ await deleteAppointmentFile(id); }catch(e){}
  renderAppointmentLetters();
}

function renderAppointmentLetters(){
  const items=getAppointmentLetters();
  const list=document.querySelector("#appointmentList");
  const count=document.querySelector("#appointmentCount");
  if(count) count.textContent=items.length;
  if(!list) return;

  if(!items.length){
    list.innerHTML='<div class="empty">No appointment letters are being tracked yet.</div>';
    return;
  }

  const sorted=items.map(item=>({...item,_status:appointmentStatus(item.expirationDate,item.expirationBasis)}))
    .sort((a,b)=>{
      const rank={expired:0,due30:1,due60:2,due90:3,current:4,unknown:5};
      const r=(rank[a._status.key]??9)-(rank[b._status.key]??9);
      if(r!==0) return r;
      if(a._status.days!=null && b._status.days!=null) return a._status.days-b._status.days;
      return String(b.addedAt||"").localeCompare(String(a.addedAt||""));
    });

  list.innerHTML=sorted.map(item=>`
    <article class="appointmentCard ${esc(item._status.key)}">
      <div class="appointmentCardTop">
        <div>
          <div class="appointmentTitle">${esc(item.title)}</div>
          <div class="appointmentSub">${esc(item.category||"Appointment Letter")}</div>
        </div>
        <span class="appointmentStatus ${esc(item._status.key)}">${esc(item._status.label)}</span>
      </div>

      <div class="appointmentGrid">
        <div><span>MEMBER(S)</span><b>${esc(item.members||"—")}</b></div>
        <div><span>ROLE</span><b>${esc(item.role||"—")}</b></div>
        <div><span>EFFECTIVE</span><b>${esc(item.effectiveDate||"—")}</b></div>
        <div><span>EXPIRATION</span><b>${esc(item.expirationDate||item.expirationBasis||"Not identified")}</b></div>
      </div>

      ${item.reference?`<div class="appointmentReference">${esc(item.reference)}</div>`:""}
      ${item.summary?`<div class="appointmentSummary">${esc(item.summary)}</div>`:""}

      <div class="appointmentActions">
        ${item.hasFile?`<button onclick="openAppointmentFile(${JSON.stringify(item.id)})">Open Letter</button>`:""}
        <button class="dangerAction" onclick="deleteAppointmentLetter(${JSON.stringify(item.id)})">Delete</button>
      </div>
    </article>
  `).join("");
}



function trainingEscapeLines(value){
  return String(value||"").split("\n").map(x=>x.trim()).filter(Boolean);
}

function renderTrainingPlan(plan){
  const out=document.querySelector("#trainingOutput");
  if(!out) return;

  const refs=Array.isArray(plan.references)?plan.references:[];
  const phases=Array.isArray(plan.phases)?plan.phases:[];
  const checks=Array.isArray(plan.knowledgeChecks)?plan.knowledgeChecks:[];
  const scenarios=Array.isArray(plan.scenarios)?plan.scenarios:[];

  out.hidden=false;
  out.innerHTML=`
    <div class="settingsCard trainingPlanCard">
      <div class="trainingPlanHeader">
        <div>
          <span class="trainingEyebrow">TAILORED TRAINING PLAN</span>
          <h3>${esc(plan.title||"Training Plan")}</h3>
          <p>${esc(plan.objective||"")}</p>
        </div>
        <span class="trainingLevelPill">${esc(plan.targetProficiency||"")}</span>
      </div>

      <div class="cfetpOutputBar">
        <div><span>CURRENT</span><b>${esc(plan.currentProficiency||"")}</b></div>
        <div class="cfetpArrow">→</div>
        <div><span>TARGET</span><b>${esc(plan.targetProficiency||"")}</b></div>
        <div class="cfetpCriterion"><span>CFETP PERFORMANCE CRITERION</span><b>${esc(plan.proficiencyCriterion||"")}</b></div>
      </div>

      <div class="trainingSplit">
        <div class="authorityPanel">
          <div class="panelLabel officialLabel">OFFICIAL / SOURCE-BASED</div>
          <div class="trainingText">${esc(plan.officialBaseline||"Not identified from indexed sources.")}</div>
        </div>
        <div class="localPanel">
          <div class="panelLabel localLabel">LOCAL PROCESS / EXPERIENCE-BASED</div>
          <div class="trainingText">${esc(plan.localAdaptation||"No local adaptation provided.")}</div>
        </div>
      </div>

      ${phases.length?`
      <div class="trainingSection">
        <h4>Training Sequence</h4>
        ${phases.map((p,i)=>`
          <div class="trainingPhase">
            <div class="phaseNumber">${i+1}</div>
            <div class="phaseBody">
              <b>${esc(p.name||`Phase ${i+1}`)}</b>
              ${p.purpose?`<p>${esc(p.purpose)}</p>`:""}
              ${Array.isArray(p.steps)&&p.steps.length?`<ol>${p.steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`:""}
              ${p.instructorFocus?`<div class="coachNote"><strong>Instructor focus:</strong> ${esc(p.instructorFocus)}</div>`:""}
              ${p.traineeStandard?`<div class="standardNote"><strong>Trainee standard:</strong> ${esc(p.traineeStandard)}</div>`:""}
            </div>
          </div>
        `).join("")}
      </div>`:""}

      ${Array.isArray(plan.commonErrors)&&plan.commonErrors.length?`
      <div class="trainingSection">
        <h4>Common Errors / Coaching Points</h4>
        <ul>${plan.commonErrors.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </div>`:""}

      ${checks.length?`
      <div class="trainingSection">
        <h4>Knowledge Checks</h4>
        <ol>${checks.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
      </div>`:""}

      ${scenarios.length?`
      <div class="trainingSection">
        <h4>Scenario Training</h4>
        ${scenarios.map((x,i)=>`<div class="scenarioCard"><b>Scenario ${i+1}</b><p>${esc(x)}</p></div>`).join("")}
      </div>`:""}

      ${plan.evaluationStandard?`
      <div class="trainingSection evaluationSection">
        <h4>Evaluation / Qualification Standard</h4>
        <p>${esc(plan.evaluationStandard)}</p>
      </div>`:""}

      ${refs.length?`
      <div class="trainingSection">
        <h4>References Used</h4>
        <div class="trainingRefs">
          ${refs.map(r=>`
            <div class="trainingRef">
              <b>${esc(r.source||"Source")}</b>
              <span>${esc(r.reference||"")}${r.page?` • Page ${esc(r.page)}`:""}</span>
              ${r.note?`<p>${esc(r.note)}</p>`:""}
            </div>
          `).join("")}
        </div>
      </div>`:""}

      <div class="trainingDisclaimer">
        Training Builder separates source-based requirements from local practices. Verify current governing guidance before qualification or certification.
      </div>
    </div>`;
  out.scrollIntoView({behavior:"smooth",block:"start"});
}


const CFETP_PROFICIENCY_MODEL={
  Basic:{
    label:"Basic",
    criterion:"Sustained application of competency over time.",
    planning:"Focus on correct execution, repetition, foundational understanding, and consistent performance of the task."
  },
  Intermediate:{
    label:"Intermediate",
    criterion:"Sustained application of competency over time in a variety of situations.",
    planning:"Expose the trainee to variations, exceptions, discrepancies, changing conditions, and multiple realistic scenarios."
  },
  Advanced:{
    label:"Advanced",
    criterion:"Sustained application of competency over time in complex situations.",
    planning:"Emphasize complex conditions, simultaneous requirements, higher-risk decisions, troubleshooting, prioritization, and leading portions of the task."
  },
  Expert:{
    label:"Expert",
    criterion:"Able to innovate and formulate strategies; able to model, guide, and teach others how to apply the competency.",
    planning:"Emphasize strategy, process improvement, instruction/coaching, integration across functions, judgment, and development of others."
  }
};

function cfetpProgressionText(current,target){
  const order=["Basic","Intermediate","Advanced","Expert"];
  const a=order.indexOf(current), b=order.indexOf(target);
  if(a<0||b<0) return "";
  if(a===b) return `Maintain and demonstrate ${target} proficiency.`;
  if(a>b) return `Use ${target} as the minimum performance target while leveraging the trainee's higher current proficiency.`;
  return `Progress from ${current} toward ${target}, increasing difficulty and independence across ${b-a} proficiency level${b-a===1?"":"s"}.`;
}

async function buildTrainingPlan(){
  const task=document.querySelector("#trainingTask")?.value.trim();
  const experience=document.querySelector("#trainingExperience")?.value||"Intermediate";
  const format=document.querySelector("#trainingFormat")?.value||"Hands-on qualification";
  const duration=document.querySelector("#trainingDuration")?.value.trim()||"";
  const target=document.querySelector("#trainingTarget")?.value||"Intermediate";
  const known=document.querySelector("#trainingKnown")?.value.trim()||"";
  const localProcess=document.querySelector("#trainingLocal")?.value.trim()||"";
  const goal=document.querySelector("#trainingGoal")?.value.trim()||"";
  const status=document.querySelector("#trainingStatus");
  const btn=document.querySelector("#buildTrainingBtn");

  if(!task){
    status.textContent="Enter a task or training topic first.";
    status.className="localSaveStatus error";
    return;
  }

  status.textContent="Building a source-grounded training plan…";
  status.className="localSaveStatus working";
  btn.disabled=true;
  btn.textContent="Building…";

  try{
    const res=await fetch("/api/build-training",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        task,experience,format,duration,target,known,localProcess,goal,
        cfetpCurrent:CFETP_PROFICIENCY_MODEL[experience]||null,
        cfetpTarget:CFETP_PROFICIENCY_MODEL[target]||null,
        cfetpProgression:cfetpProgressionText(experience,target),
        officialSources:retrieveOfficialSourcesForAI(task,14),
        localResources:getLocalKnowledge().slice(0,40),
        readFile:getATOCReadFile().slice(0,40)
      })
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data?.error||"Unable to build the training plan.");
    renderTrainingPlan(data.plan||{});
    status.textContent="Training plan built. Review the source-based and local sections before using it.";
    status.className="localSaveStatus success";
  }catch(err){
    status.textContent=err.message||"Unable to build the training plan.";
    status.className="localSaveStatus error";
  }finally{
    btn.disabled=false;
    btn.textContent="✦ Build Training Plan";
  }
}


async function checkAIBackend(){
  const el=document.querySelector("#aiBackendStatus");
  if(!el) return;
  el.textContent="Checking Cloudflare AI backend…";
  try{
    const r=await fetch("/api/health",{cache:"no-store"});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"Backend check failed.");
    if(d.openaiConfigured){
      el.innerHTML="<b>Ready</b> — Cloudflare Worker is active and OPENAI_API_KEY is configured.";
      el.className="statusText aiReady";
    }else{
      el.innerHTML="<b>Worker active</b> — add the OPENAI_API_KEY secret in Cloudflare to enable AI features.";
      el.className="statusText aiNeedsKey";
    }
  }catch(e){
    el.textContent="AI backend is not reachable in this deployment.";
    el.className="statusText aiError";
  }
}
