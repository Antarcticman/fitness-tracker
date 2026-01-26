// ====== Catalog (預設值) ======
let CATALOG = {
  chest: { label: "胸", exercises: ["啞鈴臥推"] } 
};

const MAX_SETS = 4; 

// ====== 狀態 ======
let currentPart = null; 
let currentActionIdx = null; 
const blocks = []; 
let idCounter = 1;
let GLOBAL_LAST_END_TIME = null; 
let SESSION_START_TIME = null; 
let importedRows = []; 
let myChart = null;
let chartUnit = "kg"; 
let displayUnit = "kg"; 

// ====== DOM ======
const appRoot   = document.getElementById("appRoot");
const bottomNav = document.getElementById("bottomNav");
const actionNav = document.getElementById("actionNav");
const finishDayBtn = document.getElementById("finishDay");
const clearAll  = document.getElementById("clearAll");
const calSideTitle = document.getElementById("calSideTitle");
const calSideList  = document.getElementById("calSideList");
let selectedCalDate = ""; 

// Export panel
const exportPanel       = document.getElementById("exportPanel");
const exportTbody       = document.getElementById("exportTableBody");
const closeExportBtn    = document.getElementById("closeExportBtn");
const confirmAppendBtn  = document.getElementById("confirmAppendBtn");

// Settings
const editorContainer = document.getElementById("editor-container");
const saveCatalogBtn = document.getElementById("saveCatalogBtn");

// Tabs
const tabs = [...document.querySelectorAll(".tab-btn")];
const pages = {
  main: document.getElementById("page-main"),
  calendar: document.getElementById("page-calendar"),
  records: document.getElementById("page-records"),
  settings: document.getElementById("page-settings") 
};

// Records page
const recordsPartRow   = document.getElementById("recordsPartChips");
const recordsActionRow = document.getElementById("recordsActionChips");
const recordsTbody   = document.getElementById("recordsTbody");
let recFilterPart = "";   
let recFilterAction = "";

// Calendar page
const calendarWeekdays = document.getElementById("calendarWeekdays");
const calendarGrid = document.getElementById("calendarGrid");
const monthLabel   = document.getElementById("monthLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
let calendarDate = new Date();

// ====== Helpers ======
const el = (tag, cls, text) => { const E = document.createElement(tag); if (cls) E.className = cls; if (text!=null) E.textContent = text; return E; };
const ymd = (d) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;

const fmtSetLine = s => {
  const kg = Number(s.weight)||0;
  const lb = kgToNearestLbStep(kg);
  return `${lb} lb (${kg} kg) · ${s.reps} 下`;
};

// 秒數格式化 (65 -> 1:05)
function fmtDuration(ms){
  if(!ms && ms !== 0) return "";
  const sec = Math.round(ms / 1000); 
  if(sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtHours(ms){
  if(!ms || ms<0) return "0分";
  const totalMin = Math.round(ms/60000);
  const h = Math.floor(totalMin/60);
  const m = totalMin % 60;
  if(h>0) return `${h}小時 ${m}分`;
  return `${m}分鐘`;
}

// ====== 全域計時器 & 狀態監控 ======
setInterval(() => {
  const activeB = blocks.find(b => b.isWorking && !b.ended);
  
  // 1. 更新卡片上的計時器 (工作)
  if (activeB && activeB.currentSetStart) {
    const el = document.getElementById(`header-timer-${activeB.id}`);
    if (el) {
      const diff = Date.now() - activeB.currentSetStart;
      el.textContent = `⏱️ ${fmtDuration(diff)}`;
    }
  }

  // 2. 更新全域背景狀態
  if (activeB) document.body.classList.add("working-mode");
  else document.body.classList.remove("working-mode");

  // 3. 更新休息計時器
  blocks.forEach(b => {
    if (!b.ended && !b.isWorking) {
        let refTime = b.lastSetEnd || (b.sets.length === 0 ? GLOBAL_LAST_END_TIME : null);
        if (refTime) {
            const el = document.getElementById(`header-timer-${b.id}`);
            if (el) {
                const diff = Date.now() - refTime;
                el.textContent = `☕ ${fmtDuration(diff)}`;
                el.className = "header-timer resting"; 
            }
        }
    }
  });
}, 500);

// ===== 轉盤工具 =====
function rangeArray(min, max, step=1){
  const out = []; for (let v=min; v<=max; v+=step) out.push(v); return out;
}

const ITEM_H = 44;     
const SPACER_COUNT = 1; 
const LB_STEP = 2.5;       
const LB_MAX  = 60;       
const KG_PER_LB = 0.45359237;

const lbToKg = (lb)=> lb * KG_PER_LB;
const kgToLb = (kg)=> kg / KG_PER_LB;

function kgToNearestLbStep(kg){
  const lb = kg / KG_PER_LB;
  return Math.round(lb / LB_STEP) * LB_STEP;
}

function buildWheel(elem, values, initialValue, onChange){
  elem.innerHTML = "";
  for (let i=0;i<SPACER_COUNT;i++){ const sp=el("div","opt spacer","-1"); elem.appendChild(sp); }
  values.forEach(v=>{ const d=el("div","opt",v); d.dataset.value=v; elem.appendChild(d); });
  for (let i=0;i<SPACER_COUNT;i++){ const sp=el("div","opt spacer","-1"); elem.appendChild(sp); }

  const children = [...elem.children];
  let isInitializing = true; 

  const highlightAndEmit = (realIdx, shouldEmit = true)=>{
    children.forEach(c=>c.classList.remove("active"));
    const childIdx = realIdx + SPACER_COUNT;
    const el = children[childIdx];
    if (el){
      el.classList.add("active");
      if(!isInitializing && shouldEmit){ onChange?.(Number(values[realIdx])); }
    }
  };

  const scrollToRealIdx = (realIdx, smooth=true)=>{
    const childIdx = realIdx + SPACER_COUNT;
    const targetTop = childIdx * ITEM_H + (ITEM_H/2 - elem.clientHeight/2);
    elem.scrollTo({ top: Math.max(0, targetTop), behavior: smooth ? "smooth" : "auto" });
    highlightAndEmit(realIdx, false); 
  };

  let timer = null;
  elem.addEventListener("scroll", ()=>{
    if(isInitializing) return; 
    clearTimeout(timer);
    timer = setTimeout(()=>{
      const center = elem.scrollTop + elem.clientHeight/2;
      let childIdx = Math.round(center / ITEM_H - 0.5);
      let realIdx = childIdx - SPACER_COUNT;
      realIdx = Math.min(Math.max(realIdx, 0), values.length - 1);
      highlightAndEmit(realIdx, true); 
    }, 50);
  });

  elem.addEventListener("click",(e)=>{
    const opt = e.target.closest(".opt");
    if (!opt) return;
    const childIdx = [...elem.children].indexOf(opt);
    let realIdx = childIdx - SPACER_COUNT;
    realIdx = Math.min(Math.max(realIdx, 0), values.length - 1);
    scrollToRealIdx(realIdx);
    setTimeout(()=> { isInitializing = false; highlightAndEmit(realIdx, true); }, 300);
  });

  const initRealIdx = Math.max(0, values.indexOf(initialValue));
  setTimeout(()=> {
    scrollToRealIdx(initRealIdx, false); 
    setTimeout(()=>{ isInitializing = false; }, 200);
  }, 0);
}

// ====== API ======
const API_BASE = "https://script.google.com/macros/s/AKfycbwy1VKGICqMwjax01HpCvYChWOuJW0H448qP9bSzJ--v9yYD8wbYrCR9aT5vYkjLBlYow/exec";

async function apiLoadRows(){
  const r = await fetch(API_BASE);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "load failed");
  if (j.catalog && Object.keys(j.catalog).length > 0) CATALOG = j.catalog;
  const rows = j.rows || [];
  return rows.map(row => {
    const d = new Date(row["日期"]);
    const logicalDate = new Date(d);
    if (logicalDate.getHours() < 7) logicalDate.setDate(logicalDate.getDate() - 1);
    row._dateStr = ymd(logicalDate);
    return row;
  });
}

async function apiAppendRows(rows){
  const r = await fetch(API_BASE, { method: "POST", body: JSON.stringify({ rows: rows }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "append failed");
  return j.appended || 0;
}

async function reloadFromBackend(){
  importedRows = await apiLoadRows();
  renderRecordsFilters(importedRows);
  renderRecordsTable();
  renderBottomNav(); 
  renderActionNav();
}

function getLastDefaultsFromCsv(partZh, actionName){
  if (!Array.isArray(importedRows) || importedRows.length === 0) return { weight:0, reps:10 };
  const rows = importedRows.filter(r => r["部位"] === partZh && r["動作"] === actionName);
  if (!rows.length) return { weight:0, reps:10 };
  rows.sort((a,b)=> (a["日期"] > b["日期"] ? 1 : -1)); 
  const last = rows[rows.length - 1];
  for (let i = 4; i >= 1; i--){
    const reps = Number(last[`組${i}`] || 0);
    const wt   = Number(last[`重${i}`] || 0);
    if (reps > 0 || wt > 0) return { weight: wt, reps: (reps || 10) };
  }
  return { weight:0, reps:10 };
}

// ====== Main Logic ======
function createBlock(part, actionIdx){
  const b = { 
    id: idCounter++, 
    part, actionIdx, ended: false, 
    temp: { reps:10, weight:0 }, 
    sets: [], activeSetIdx: null,
    isWorking: false, currentSetStart: null, currentWorkStart: null, tempRestTime: 0 
  };
  blocks.push(b);
  return b;
}

function getActiveBlock(){
  for (let i = blocks.length - 1; i >= 0; i--) if (!blocks[i].ended) return blocks[i];
  return undefined; 
}

function renderMain(){
  appRoot.innerHTML = "";
  blocks.forEach((b) => { appRoot.appendChild(renderBlock(b)); });
  renderBottomNav();
  renderActionNav();
}

function renderBlock(b){
  const blockCls = "block" + (b.ended ? " disabled" : "") + (b.isWorking ? " active-block" : "");
  const wrap = el("section", blockCls);
  
  // Left
  const leftCol = el("div", "block-left-col");
  const head = el("div","summary");
  const headTop = el("div", "summary-top");
  
  const headInfo = el("div", "head-info");
  const catData = CATALOG[b.part] || { label: b.part, exercises: [] };
  const tag = el("span","tag", catData.label);
  const hname = el("span","hname", catData.exercises[b.actionIdx] || "");
  headInfo.append(tag, hname);

  // Header Timer
  const timerDiv = el("div", "header-timer");
  timerDiv.id = `header-timer-${b.id}`;

  const headRight = el("div", "head-right");
  if(b.ended){
  } else {
    const delBlockBtn = el("button", "del-btn", "✕");
    delBlockBtn.onclick = () => {
      if(confirm("確定要刪除這個動作紀錄嗎？")){
        const idx = blocks.indexOf(b);
        if(idx > -1) blocks.splice(idx, 1);
        if(blocks.length === 0) { currentActionIdx = null; GLOBAL_LAST_END_TIME = null; SESSION_START_TIME = null; }
        renderMain();
        renderActionNav();
      }
    };
    headRight.append(delBlockBtn);
  }
  headTop.append(headInfo, timerDiv, headRight);

  const sText = el("div","text"); 
  head.append(headTop, sText);

  const pickerWrap = el("div","picker");
  const colW = el("div","col"); colW.append(el("div","lab","重量"));
  const wheelW = el("div","wheel"); colW.append(wheelW, el("div","lab2","lb"));
  const colR = el("div","col"); colR.append(el("div","lab","幾下"));
  const wheelR = el("div","wheel"); colR.append(wheelR, el("div","lab2","下"));
  pickerWrap.append(colW, colR);

  const btnGroup = el("div", "action-btn-group");
  const actionBtn = el("button", "btn"); 
  actionBtn.style.width = "100%";
  btnGroup.append(actionBtn);
  leftCol.append(head, pickerWrap, btnGroup);

  // Right
  const rightCol = el("div", "block-right-col");
  rightCol.append(el("div","title","本動作紀錄"));
  const listWrap = el("ul","set-list");   
  listWrap.style.flex = "1"; 
  const rightFooter = el("div", "right-col-footer");
  const endBtn  = el("button", "btn btn-danger", "結束此動作");
  endBtn.style.width = "100%";
  rightFooter.append(endBtn);
  rightCol.append(listWrap, rightFooter);

  const updateSummary = ()=>{
    if(b.isWorking) timerDiv.className = "header-timer working";
    else timerDiv.className = "header-timer resting";

    if (b.ended){ 
      sText.textContent = "✓ 此動作已完成"; 
      sText.style.color = "var(--text-muted)";
      timerDiv.textContent = ""; 
      return; 
    }
    const idx = (b.activeSetIdx===null) ? (b.sets.length+1) : (b.activeSetIdx+1);
    if (b.isWorking) {
        sText.textContent = `🔥 第 ${idx} 組進行中...`;
        sText.style.color = "#4ade80"; 
        actionBtn.textContent = "完成這一組";
        actionBtn.className = "btn btn-danger"; 
    } else {
        const src = (b.activeSetIdx===null) ? b.temp : b.sets[b.activeSetIdx];
        const kg = Number(src.weight)||0;
        const lb = kgToNearestLbStep(kg);
        
        let refTime = b.lastSetEnd || (b.sets.length===0 ? GLOBAL_LAST_END_TIME : null);
        if(refTime) {
             const diff = Date.now() - refTime;
             timerDiv.textContent = `☕ ${fmtDuration(diff)}`;
        } else {
             timerDiv.textContent = ""; 
        }

        sText.textContent = (idx > MAX_SETS) ? "已完成四組訓練" : `準備：${lb} lb (${kg} kg) · ${src.reps} 下`;
        sText.style.color = "var(--accent)";
        actionBtn.textContent = (idx > MAX_SETS) ? "已完成四組" : "開始這一組";
        actionBtn.className = "btn btn-start"; 
    }
  };

  function rebuildWheels(){                          
    const editingExisting = b.activeSetIdx !== null;
    const src = editingExisting ? b.sets[b.activeSetIdx] : b.temp;
    const lbValues = []; for (let lb=0; lb<=LB_MAX; lb+=LB_STEP) lbValues.push(lb);
    const initLb = kgToNearestLbStep(Number(src.weight)||0);
    buildWheel(wheelW, lbValues, initLb, (valLb)=>{
      const valKg = Math.round(lbToKg(valLb)*10)/10;
      if (b.activeSetIdx===null) b.temp.weight = valKg; else b.sets[b.activeSetIdx].weight = valKg;
      const idx = (b.activeSetIdx===null) ? (b.sets.length+1) : (b.activeSetIdx+1);
      if(!b.isWorking && idx <= MAX_SETS) {
         const lb = kgToNearestLbStep(valKg);
         sText.textContent = `準備：${lb} lb (${valKg} kg) · ${src.reps} 下`;
      }
    });
    buildWheel(wheelR, rangeArray(1,20,1), Number(src.reps)||10, (val)=>{
      if (b.activeSetIdx===null) b.temp.reps = val; else b.sets[b.activeSetIdx].reps = val;
      const idx = (b.activeSetIdx===null) ? (b.sets.length+1) : (b.activeSetIdx+1);
      if(!b.isWorking && idx <= MAX_SETS) {
         const kg = Number(src.weight)||0; const lb = kgToNearestLbStep(kg);
         sText.textContent = `準備：${lb} lb (${kg} kg) · ${val} 下`;
      }
    });
  }
  rebuildWheels();                                   

  function refreshButtons(){
    if (b.ended) {
        actionBtn.style.display = "none";
        endBtn.disabled = true; endBtn.textContent = "已完成此動作"; endBtn.className = "btn"; endBtn.style.opacity = "0.5";
        return;
    }
    const full = b.sets.length >= MAX_SETS;
    if (b.isWorking) {
        actionBtn.style.display = "inline-flex"; actionBtn.disabled = false;
        endBtn.disabled = true; endBtn.style.opacity = "0.5"; endBtn.textContent = "訓練進行中...";
    } else {
        actionBtn.style.display = "inline-flex"; actionBtn.disabled = full; 
        if (b.sets.length > 0) { endBtn.disabled = false; endBtn.style.opacity = "1"; endBtn.textContent = "結束此動作"; } 
        else { endBtn.disabled = true; endBtn.style.opacity = "0.5"; endBtn.textContent = "請先完成一組"; }
    }
  }

  function renderSetListInner(container, bRef){
    container.innerHTML = "";
    bRef.sets.slice(0, MAX_SETS).forEach((s, idx)=>{
      if (s.restTime) container.append(el("div", "rest-separator", `休 ${fmtDuration(s.restTime)}`));
      
      const li = el("li","set-item"+(idx===bRef.activeSetIdx?" active":""));
      const infoDiv = el("div", "set-info");
      let workTag = "";
      if (s.workTime) workTag = `<span class=\"work-tag\">⏱ ${fmtDuration(s.workTime)}</span>`;

      infoDiv.innerHTML = `
        <div class="set-info-row">
            <div class="badge">第 ${idx+1} 組</div>
            <div class="sline">${fmtSetLine(s)}</div>
            ${workTag}
        </div>
      `;
      infoDiv.addEventListener("click", ()=>{
        if(bRef.isWorking) return; 
        bRef.activeSetIdx = idx;
        rebuildWheels(); updateSummary(); renderSetListInner(container, bRef); refreshButtons();
      });
      const delBtn = el("button", "del-btn", "✕");
      delBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        if(bRef.isWorking) { alert("請先完成目前這一組"); return; }
        if(confirm(`確定刪除第 ${idx+1} 組嗎？`)){
          bRef.sets.splice(idx, 1); bRef.activeSetIdx = null;
          if(bRef.sets.length > 0) bRef.temp = { ...bRef.sets[bRef.sets.length-1] };
          rebuildWheels(); updateSummary(); renderSetListInner(container, bRef); refreshButtons();
        }
      });
      li.append(infoDiv, delBtn);
      container.append(li);
    });
    
    // Ghost Row
    if(bRef.isWorking) {
      const ghostLi = el("li", "set-item ghost");
      ghostLi.innerHTML = `
        <div class="set-info-row" style="justify-content:center; color:var(--accent-work);">
           <span class="badge" style="background:var(--accent-work); color:#000;">進行中</span>
           <span>數據調整中...</span>
        </div>`;
      container.append(ghostLi);
      if(bRef.tempRestTime) container.insertBefore(el("div", "rest-separator", `休 ${fmtDuration(bRef.tempRestTime)}`), ghostLi);
    }
  }

  renderSetListInner(listWrap, b);
  updateSummary();
  refreshButtons(); 

  actionBtn.addEventListener("click", ()=>{
    if (b.ended) return;
    const now = Date.now();
    if(!SESSION_START_TIME) SESSION_START_TIME = now;

    if (!b.isWorking) {
        // === START ===
        b.isWorking = true; b.currentSetStart = now; 
        let lastEnd = GLOBAL_LAST_END_TIME; 
        if(!lastEnd && b.sets.length===0) lastEnd = GLOBAL_LAST_END_TIME; 
        
        let rest = 0; if(lastEnd) rest = now - lastEnd; 
        b.tempRestTime = rest;

        // Force Immediate Update
        timerDiv.textContent = `⏱️ 0:00`;
        timerDiv.className = "header-timer working";

        wrap.classList.add("active-block");
        updateSummary(); refreshButtons(); renderSetListInner(listWrap, b);
    } else {
        // === FINISH ===
        b.isWorking = false;
        let work = 0; if(b.currentSetStart) work = now - b.currentSetStart;
        GLOBAL_LAST_END_TIME = now;
        
        // Force Immediate Update
        timerDiv.textContent = `☕ 0:00`;
        timerDiv.className = "header-timer resting";

        const src = (b.activeSetIdx===null) ? b.temp : b.sets[b.activeSetIdx];
        if (b.activeSetIdx === null) {
            b.sets.push({ reps: src.reps, weight: src.weight, restTime: b.tempRestTime, workTime: work });
            b.temp = { reps: src.reps, weight: src.weight }; 
        } else {
            const old = b.sets[b.activeSetIdx];
            b.sets[b.activeSetIdx] = { ...old, reps: src.reps, weight: src.weight }; 
            b.activeSetIdx = null; 
        }
        b.lastSetEnd = now;
        wrap.classList.remove("active-block");
        rebuildWheels(); updateSummary(); renderSetListInner(listWrap, b); refreshButtons();
    }
  });

  endBtn.addEventListener("click", ()=>{
    if (b.ended) return;
    if (confirm("確定結束此動作？")){
        b.ended = true; wrap.classList.add("disabled");
        updateSummary(); refreshButtons();
        currentActionIdx = null; renderActionNav(); renderMain();
    }
  });
  wrap.append(leftCol, rightCol);
  return wrap;
}

function renderBottomNav(){
  bottomNav.innerHTML = "";
  Object.entries(CATALOG).forEach(([k,v])=>{
    const btn = el("button","nav-btn"+(k===currentPart?" active":""));
    btn.appendChild(el("span", "", v.label));
    btn.addEventListener("click",()=>{
      const activeB = getActiveBlock();
      if (activeB && !activeB.ended) { alert("請先完成或刪除目前的動作，才能切換部位！"); return; }
      currentPart = k; currentActionIdx = null; 
      renderBottomNav(); renderActionNav(); 
    });
    bottomNav.append(btn);
  });
}

function renderActionNav(){
  actionNav.innerHTML = "";
  if(!currentPart) return; 
  const catData = CATALOG[currentPart];
  if(!catData) return;
  const activeB = getActiveBlock();
  catData.exercises.forEach((name, i)=>{
    const isActive = (activeB && activeB.part === currentPart && activeB.actionIdx === i);
    const chip = el("div","action-chip"+(isActive?" active":""), name);
    chip.addEventListener("click",()=>{
      const currentActive = getActiveBlock();
      if (currentActive && !currentActive.ended) {
        if (currentActive.part === currentPart && currentActive.actionIdx === i) return;
        alert("請先完成或刪除目前的動作，才能選擇下一個動作！"); return;
      }
      currentActionIdx = i;
      createBlock(currentPart, i);
      const nb = getActiveBlock();
      const partZh = CATALOG[nb.part].label;
      const nm   = CATALOG[nb.part].exercises[nb.actionIdx];
      const last = getLastDefaultsFromCsv(partZh, nm);
      nb.temp = { reps:last.reps, weight:last.weight };
      renderActionNav(); renderMain();      
    });
    actionNav.append(chip);
  });
}
// ====== Export ======
function blockToRow(b, dateStr){
  const part = CATALOG[b.part]?.label || b.part;
  const action = CATALOG[b.part]?.exercises[b.actionIdx] || "";
  const reps=[0,0,0,0], wts=[0,0,0,0], rests=[0,0,0,0], works=[0,0,0,0];
  b.sets.slice(0,4).forEach((s,i)=>{ 
    reps[i]=s.reps||0; wts[i]=s.weight||0; 
    rests[i]=Math.round((s.restTime||0)/1000); works[i]=Math.round((s.workTime||0)/1000);
  });
  return { 
    "日期":dateStr,"部位":part,"動作":action,
    "組1":reps[0],"組2":reps[1],"組3":reps[2],"組4":reps[3],
    "重1":wts[0],"重2":wts[1],"重3":wts[2],"重4":wts[3],
    "休1":rests[0],"秒1":works[0],"休2":rests[1],"秒2":works[1],
    "休3":rests[2],"秒3":works[2],"休4":rests[3],"秒4":works[3]
  };
}
function collectTodayRows(){
  const nowISO = new Date().toISOString(); 
  return blocks.filter(b=>b.sets.length>0).map(b=>blockToRow(b, nowISO));
}
function renderExportPreview(rows){
  const container = document.getElementById("exportTableBody");
  if(!container) return; container.innerHTML = ""; container.className = "export-preview";
  let totalTimeHtml = "";
  if(SESSION_START_TIME) {
     const duration = Date.now() - SESSION_START_TIME;
     totalTimeHtml = `<div style="text-align:center; padding:10px; color:var(--accent-work); font-weight:bold; border-bottom:1px solid #333;">
       ⏱ 今日訓練總時長：${fmtHours(duration)}
     </div>`;
  }
  container.innerHTML = totalTimeHtml;
  rows.forEach(r => {
    let setDesc = [];
    for(let i=1; i<=4; i++) { if(r[`組${i}`] > 0) setDesc.push(`${r[`組${i}`]}x${r[`重${i}`]}`); }
    const div = el("div", "ep-row");
    div.innerHTML = `<span>${r["動作"]}</span> <span style="color:#888">${setDesc.length} 組</span>`;
    container.appendChild(div);
  });
}
function resetMainFromCsv(){
  if(!confirm("確定要清除所有目前的訓練卡片嗎？")) return;
  blocks.length = 0; idCounter = 1; currentPart = null; currentActionIdx = null; GLOBAL_LAST_END_TIME = null; SESSION_START_TIME = null;
  renderBottomNav(); renderActionNav(); renderMain();
}

finishDayBtn?.addEventListener("click", ()=>{
  const rows = collectTodayRows();
  if (!rows.length){ alert("尚未有任何組數紀錄。"); return; }
  document.getElementById("exportTitle").textContent = "本次運動總結";
  renderExportPreview(rows);
  exportPanel.classList.remove("hidden");
});
closeExportBtn?.addEventListener("click", ()=> exportPanel.classList.add("hidden"));
confirmAppendBtn?.addEventListener("click", async ()=>{
  confirmAppendBtn.disabled = true; confirmAppendBtn.textContent = "同步中...";
  try{
    const rows = collectTodayRows();
    if (!rows.length){ alert("尚未有任何組數紀錄。"); confirmAppendBtn.disabled=false; return; }
    const appended = await apiAppendRows(rows); 
    await reloadFromBackend(); 
    exportPanel.classList.add("hidden"); resetMainFromCsv();
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="records"]')?.classList.add("active");
    Object.values(pages).forEach(p => p.classList.remove("show"));
    pages.records.classList.add("show");
    renderRecordsTable(); 
    alert(`同步成功！已儲存 ${appended} 筆紀錄。`);
  }catch(e){ console.error(e); alert("同步發生異常\n" + e.message); } 
  finally { confirmAppendBtn.disabled = false; confirmAppendBtn.textContent = "完成"; }
});
clearAll?.addEventListener("click", resetMainFromCsv);

// ====== Records Filter & Table ======
function renderRecordsFilters(rows){ renderRecordsPartChips(); renderRecordsActionChips(); }
function renderRecordsPartChips(){
  const parts = [...new Set((importedRows||[]).map(r=>r["部位"]).filter(Boolean))];
  recordsPartRow.innerHTML = "";
  const allBtn = el("button","chip"+(recFilterPart===""?" active":""),"全部部位");
  allBtn.addEventListener("click", ()=>{ recFilterPart=""; recFilterAction=""; renderRecordsPartChips(); renderRecordsActionChips(); renderRecordsTable(); });
  recordsPartRow.append(allBtn);
  parts.forEach(p=>{
    const btn = el("button","chip"+(recFilterPart===p?" active":""), p);
    btn.addEventListener("click", ()=>{ recFilterPart=p; recFilterAction=""; renderRecordsPartChips(); renderRecordsActionChips(); renderRecordsTable(); });
    recordsPartRow.append(btn);
  });
}
function renderRecordsActionChips(){
  recordsActionRow.innerHTML = "";
  let pool = (importedRows||[]); if (recFilterPart) pool = pool.filter(r=>r["部位"]===recFilterPart);
  const actions = [...new Set(pool.map(r=>r["動作"]).filter(Boolean))];
  if (!recFilterPart){ recordsActionRow.append(el("div","muted","請先選擇上方的部位")); return; }
  const allBtn = el("button","chip"+(recFilterAction===""?" active":""),"全部動作");
  allBtn.addEventListener("click", ()=>{ recFilterAction=""; renderRecordsActionChips(); renderRecordsTable(); });
  recordsActionRow.append(allBtn);
  actions.forEach(a=>{
    const btn = el("button","chip"+(recFilterAction===a?" active":""), a);
    btn.addEventListener("click", ()=>{ recFilterAction=a; renderRecordsActionChips(); renderRecordsTable(); });
    recordsActionRow.append(btn);
  });
}

// Chart Logic
function renderTrendChart(rows, actionName){
  const container = document.querySelector('.chart-container');
  const ctx = document.getElementById('progressChart');
  if(!actionName || !rows || rows.length === 0){ if(container) container.style.display = 'none'; return; }
  const dailyMaxMap = new Map();
  rows.forEach(r => {
    const weights = [r["重1"], r["重2"], r["重3"], r["重4"]].map(v=>Number(v)||0);
    let maxW = Math.max(...weights); if(maxW <= 0) return;
    if(chartUnit === "lb") maxW = kgToNearestLbStep(maxW);
    const dStr = r._dateStr || r["日期"]; 
    if(!dailyMaxMap.has(dStr)) dailyMaxMap.set(dStr, maxW); else dailyMaxMap.set(dStr, Math.max(dailyMaxMap.get(dStr), maxW));
  });
  const sortedDates = [...dailyMaxMap.keys()].sort();
  const dataPoints = sortedDates.map(d => dailyMaxMap.get(d));
  if(container) container.style.display = 'block';
  if(myChart) myChart.destroy();
  const accentColor = '#a855f7'; 
  const unitLabel = chartUnit.toUpperCase();
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{ label: `${actionName} - 最大重量 (${unitLabel})`, data: dataPoints, borderColor: accentColor, backgroundColor: 'rgba(168, 85, 247, 0.2)', borderWidth: 3, pointBackgroundColor: '#fff', pointRadius: 4, tension: 0.1, fill: true }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#fff' } }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(30, 30, 40, 0.9)', titleColor: accentColor, bodyColor: '#fff', callbacks: { label: function(context) { return `${context.parsed.y} ${unitLabel}`; } } } },
      scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } }, y: { beginAtZero: false, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' }, title: { display: true, text: unitLabel, color: '#666' } } },
      interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
  });
}

function renderRecordsTable(){
  let rows = Array.isArray(importedRows) ? [...importedRows] : [];
  if (recFilterPart) rows = rows.filter(r => r["部位"] === recFilterPart);
  if (recFilterAction) rows = rows.filter(r => r["動作"] === recFilterAction);
  chartUnit = displayUnit; 
  renderTrendChart(rows, recFilterAction);
  rows.sort((a,b)=> (a["日期"] < b["日期"] ? 1 : (a["日期"] > b["日期"] ? -1 : 0)));
  recordsTbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    const dateRaw = r["日期"] || ""; const cleanDate = r._dateStr || dateRaw.split("T")[0];
    [cleanDate, r["部位"], r["動作"]].forEach(txt => { const td = document.createElement("td"); td.textContent = txt; tr.appendChild(td); });
    for(let i=1; i<=4; i++){
       const td = document.createElement("td");
       const reps = Number(r[`組${i}`]) || 0; const weight = Number(r[`重${i}`]) || 0; const sec = Number(r[`秒${i}`]) || 0;
       if(reps > 0 || weight > 0){
           let wDisplay = "";
           if(displayUnit === "lb"){ const lb = kgToNearestLbStep(weight); wDisplay = `${lb} lb`; } else { wDisplay = `${weight} kg`; }
           let timeHtml = sec > 0 ? `<span style="font-size:0.7em; color:#4ade80;">⏱${sec}s</span>` : "";
           td.innerHTML = `<div style="font-weight:bold; color:#fff;">${reps} 下</div><div class="cell-sub">${wDisplay}</div>${timeHtml}`;
       } else { td.textContent = "-"; td.style.color = "#444"; }
       tr.appendChild(td);
    }
    recordsTbody.appendChild(tr);
  });
  const floatBtn = document.getElementById("toggleUnitFloatBtn");
  if(floatBtn) {
      floatBtn.textContent = `單位: ${displayUnit.toUpperCase()}`;
      floatBtn.onclick = null; 
      floatBtn.onclick = () => { displayUnit = (displayUnit === "lb" ? "kg" : "lb"); renderRecordsTable(); };
  }
}

// ====== Calendar Logic ======
function renderCalendarWeekdays(){
  const zh = ["日","一","二","三","四","五","六"];
  calendarWeekdays.innerHTML = zh.map(w=>`<div class="weekday">${w}</div>`).join("");
}
function partDotClass(partZh){
  const map = { "胸":"dot-chest","背":"dot-back","臀腿":"dot-legs","肩":"dot-shoulder","肱二頭":"dot-biceps","肱三頭":"dot-triceps","腰腹":"dot-core","前臂":"dot-cardio" };
  return map[partZh] || "dot-core";
}
function renderCalendar(){
  const rows = [...importedRows];
  const partsByDate = {};
  rows.forEach(r=>{
    const dStr = r._dateStr || (r["日期"]||"").split("T")[0].replace(/-/g, '/');
    if (!dStr) return;
    (partsByDate[dStr] = partsByDate[dStr] || new Set()).add(r["部位"]);
  });
  const y = calendarDate.getFullYear(); const m = calendarDate.getMonth();
  const daysInMonth = new Date(y, m+1, 0).getDate(); const first = new Date(y, m, 1); const startDow = first.getDay();
  monthLabel.textContent = `${y}/${String(m+1).padStart(2,"0")}`; calendarGrid.innerHTML = "";
  for (let i=0;i<42;i++){
    const cell = el("div","day"); const dayNum = i - startDow + 1;
    if (dayNum > 0 && dayNum <= daysInMonth){
      const dateStr = ymd(new Date(y, m, dayNum));
      cell.append(el("div","d", String(dayNum)));
      const badges = el("div","badges");
      const parts = Array.from(partsByDate[dateStr] || []);
      parts.forEach(p=>{ const b = el("div","badge"); b.append(el("span",`dot ${partDotClass(p)}`)); badges.append(b); });
      cell.append(badges);
      cell.addEventListener("click", ()=>{ document.querySelectorAll(".day.selected").forEach(d=>d.classList.remove("selected")); cell.classList.add("selected"); selectedCalDate = dateStr; renderCalendarDetails(); });
      if (selectedCalDate === dateStr) cell.classList.add("selected");
    }
    calendarGrid.append(cell);
  }
  renderCalendarDetails();
}
function renderCalendarDetails(){
  calSideList.innerHTML = "";
  if (!selectedCalDate){ calSideTitle.textContent = "選擇日期查看詳情"; return; }
  calSideTitle.textContent = selectedCalDate;
  const rows = (importedRows || []).filter(r => (r._dateStr || r["日期"]) === selectedCalDate);
  if (rows.length === 0){ calSideList.append(el("li","side-item","這一天沒有紀錄")); return; }
  rows.forEach(r=>{
    const li = el("li","side-item");
    const top = el("div","si-top"); top.append(el("span","", `${r["部位"]} · ${r["動作"]}`)); li.append(top);
    const detail = el("div","si-sub");
    for (let i=1;i<=4;i++){
      const reps = Number(r[`組${i}`]) || 0; const wkg  = Number(r[`重${i}`]) || 0;
      if (reps || wkg){ const lb = kgToNearestLbStep(wkg); detail.append(el("div","si-line", `${reps} 下 @ ${lb} lb (${wkg} kg)`)); }
    }
    li.append(detail); calSideList.append(li);
  });
}
prevMonthBtn?.addEventListener("click", ()=>{ calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1, 1); renderCalendar(); });
nextMonthBtn?.addEventListener("click", ()=>{ calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1, 1); renderCalendar(); });

// ====== Settings Editor Logic ======
function renderEditor(){
  if(!editorContainer) return; editorContainer.innerHTML = "";
  Object.entries(CATALOG).forEach(([key, val]) => {
    const box = el("div", "edit-group");
    const head = el("div", "eg-head"); head.innerHTML = `<strong>${val.label}</strong> <span style="font-size:0.8em;opacity:0.6">(${key})</span>`;
    const delPartBtn = el("button", "btn btn-danger btn-sm", "刪除部位");
    delPartBtn.onclick = () => { if(confirm(`確定刪除「${val.label}」及其所有動作？`)) { delete CATALOG[key]; renderEditor(); } };
    head.appendChild(delPartBtn); box.appendChild(head);
    const ul = el("ul", "eg-list");
    val.exercises.forEach((ex, idx) => {
      const li = el("li", "eg-item"); li.innerHTML = `<span>${ex}</span>`;
      const delExBtn = el("button", "btn btn-danger btn-sm", "×");
      delExBtn.onclick = () => { val.exercises.splice(idx, 1); renderEditor(); };
      li.appendChild(delExBtn); ul.appendChild(li);
    });
    box.appendChild(ul);
    const addRow = el("div", "eg-add-row");
    const input = el("input", "eg-input"); input.placeholder = "輸入新動作...";
    const addBtn = el("button", "btn btn-primary btn-sm", "新增");
    const doAdd = () => { if(input.value.trim()){ val.exercises.push(input.value.trim()); renderEditor(); } };
    addBtn.onclick = doAdd; input.onkeydown = (e) => { if(e.key==="Enter") doAdd(); };
    addRow.append(input, addBtn); box.appendChild(addRow);
    editorContainer.appendChild(box);
  });
  const newPartBox = el("div", "edit-group new-part-box"); newPartBox.innerHTML = `<div class="eg-head"><strong>＋ 新增一個部位類別</strong></div>`;
  const npRow = el("div", "eg-add-row");
  const keyInput = el("input", "eg-input"); keyInput.placeholder = "ID (英文,如 legs)";
  const labelInput = el("input", "eg-input"); labelInput.placeholder = "顯示名稱 (如 臀腿)";
  const npBtn = el("button", "btn btn-primary btn-sm", "新增");
  npBtn.onclick = () => {
    const k = keyInput.value.trim(); const l = labelInput.value.trim();
    if(k && l){ if(CATALOG[k]) { alert("ID 已存在"); return; } CATALOG[k] = { label: l, exercises: [] }; renderEditor(); } else { alert("請輸入完整"); }
  };
  npRow.append(keyInput, labelInput, npBtn); newPartBox.appendChild(npRow); editorContainer.appendChild(newPartBox);
}
saveCatalogBtn?.addEventListener("click", async () => {
  saveCatalogBtn.disabled = true; saveCatalogBtn.textContent = "儲存中...";
  try {
    const r = await fetch(API_BASE, { method: "POST", body: JSON.stringify({ type: "config", catalog: CATALOG }), });
    const j = await r.json();
    if(j.ok) { alert("設定已儲存！"); renderBottomNav(); renderActionNav(); } else { alert("儲存失敗：" + j.error); }
  } catch(e) { alert("連線錯誤"); console.error(e); }
  saveCatalogBtn.disabled = false; saveCatalogBtn.textContent = "儲存變更到雲端";
});

// ====== Tabs Switching ======
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active")); btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.values(pages).forEach(p=>p?.classList.remove("show"));
    if(pages[tab]) pages[tab].classList.add("show");
    if(tab === "settings") { document.getElementById("page-settings")?.classList.add("show"); renderEditor(); }
    if (tab === "calendar") { renderCalendarWeekdays(); renderCalendar(); }
    if (tab === "records")  { renderRecordsTable(); }
  });
});

// ====== Init ======
(async function init(){
  try { await reloadFromBackend(); } catch(e){ console.warn("後端連線中...", e); }
  renderCalendarWeekdays();
  blocks.length = 0; idCounter = 1; currentPart = null; currentActionIdx = null; GLOBAL_LAST_END_TIME = null; SESSION_START_TIME = null;
  if(importedRows.length > 0) renderRecordsFilters(importedRows); 
  renderRecordsTable();
  renderBottomNav(); renderActionNav(); renderMain();
})();