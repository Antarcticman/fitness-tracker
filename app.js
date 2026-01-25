// ====== Catalog (預設值，實際會從後端讀取) ======
let CATALOG = {
  chest: { label: "胸", exercises: ["啞鈴臥推"] } 
};

const MAX_SETS = 4; // 每動作最多四組

// ====== 狀態（主頁） ======
let currentPart = "chest";
const blocks = []; // [{id, part, actionIdx, ended, temp:{reps,weight}, sets:[{reps,weight}], activeSetIdx}]
let idCounter = 1;
let importedRows = []; // 儲存從後端抓回來的資料

// ====== DOM ======
// Main
const appRoot   = document.getElementById("appRoot");
const bottomNav = document.getElementById("bottomNav");
const actionNav = document.getElementById("actionNav");
const finishDayBtn = document.getElementById("finishDay");
const clearAll  = document.getElementById("clearAll");
const calSideTitle = document.getElementById("calSideTitle");
const calSideList  = document.getElementById("calSideList");
let selectedCalDate = ""; // "YYYY/MM/DD"

// Export panel
const exportPanel       = document.getElementById("exportPanel");
const exportTbody       = document.getElementById("exportTableBody");
const closeExportBtn    = document.getElementById("closeExportBtn");
const confirmAppendBtn  = document.getElementById("confirmAppendBtn");

// Settings Editor DOM
const editorContainer = document.getElementById("editor-container");
const saveCatalogBtn = document.getElementById("saveCatalogBtn");

// Tabs & Pages
const tabs = [...document.querySelectorAll(".tab-btn")];
const pages = {
  main: document.getElementById("page-main"),
  calendar: document.getElementById("page-calendar"),
  records: document.getElementById("page-records"),
  settings: document.getElementById("page-settings") // 確保這裡抓得到
};

// Records page
const recordsPartRow   = document.getElementById("recordsPartChips");
const recordsActionRow = document.getElementById("recordsActionChips");
const recordsTbody   = document.getElementById("recordsTbody");
let recFilterPart = "";   // 儲存 chips 選擇
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

// ===== 轉盤工具 =====
function rangeArray(min, max, step=1){
  const out = [];
  for (let v=min; v<=max; v+=step) out.push(v);
  return out;
}

const ITEM_H = 44;     
const WHEEL_H = 140;   
const SPACER_COUNT = 1; 

// === 單位設定 ===
const LB_STEP = 2.5;       
const LB_MAX  = 60;       
const KG_PER_LB = 0.45359237;

// 換算
const lbToKg = (lb)=> lb * KG_PER_LB;
const kgToLb = (kg)=> kg / KG_PER_LB;

function kgToNearestLbStep(kg){
  const lb = kg / KG_PER_LB;
  return Math.round(lb / LB_STEP) * LB_STEP;
}

/**
 * 建立輪盤內容
 */
function buildWheel(elem, values, initialValue, onChange){
  elem.innerHTML = "";

  // 建立頂部 spacer
  for (let i=0;i<SPACER_COUNT;i++){
    const sp = document.createElement("div");
    sp.className = "opt spacer";
    sp.textContent = "-1";
    elem.appendChild(sp);
  }
  // 建立選項
  values.forEach(v=>{
    const d = document.createElement("div");
    d.className = "opt";
    d.dataset.value = v;
    d.textContent = v;
    elem.appendChild(d);
  });
  // 建立底部 spacer
  for (let i=0;i<SPACER_COUNT;i++){
    const sp = document.createElement("div");
    sp.className = "opt spacer";
    sp.textContent = "-1";
    elem.appendChild(sp);
  }

  const children = [...elem.children];
  let isInitializing = true; // ★ 新增：初始化旗標

  const highlightAndEmit = (realIdx, shouldEmit = true)=>{
    children.forEach(c=>c.classList.remove("active"));
    const childIdx = realIdx + SPACER_COUNT;
    const el = children[childIdx];
    if (el){
      el.classList.add("active");
      // ★ 只有在非初始化狀態，且允許 emit 時才寫入資料
      if(!isInitializing && shouldEmit){
        onChange?.(Number(values[realIdx]));
      }
    }
  };

  const scrollToRealIdx = (realIdx, smooth=true)=>{
    const childIdx = realIdx + SPACER_COUNT;
    // ★ 修正計算公式：確保數學完美置中 (因為 CSS 改成了 132px)
    const targetTop = childIdx * ITEM_H + (ITEM_H/2 - elem.clientHeight/2);
    elem.scrollTo({ top: Math.max(0, targetTop), behavior: smooth ? "smooth" : "auto" });
    highlightAndEmit(realIdx, false); // 捲動當下不急著 emit，等 scroll 事件確認
  };

  // 捲動監聽
  let timer = null;
  elem.addEventListener("scroll", ()=>{
    if(isInitializing) return; // ★ 初始化時的捲動直接忽略，避免數值亂跳

    clearTimeout(timer);
    timer = setTimeout(()=>{
      const center = elem.scrollTop + elem.clientHeight/2;
      let childIdx = Math.round(center / ITEM_H - 0.5);
      let realIdx = childIdx - SPACER_COUNT;
      realIdx = Math.min(Math.max(realIdx, 0), values.length - 1);
      
      // 這裡才是真正更新數據的地方
      highlightAndEmit(realIdx, true); 
    }, 50); // 時間縮短一點，反應快一點
  });

  elem.addEventListener("click",(e)=>{
    const opt = e.target.closest(".opt");
    if (!opt) return;
    const childrenArr = [...elem.children];
    const childIdx = childrenArr.indexOf(opt);
    let realIdx = childIdx - SPACER_COUNT;
    realIdx = Math.min(Math.max(realIdx, 0), values.length - 1);
    scrollToRealIdx(realIdx);
    
    // 點擊可以強制更新
    setTimeout(()=> {
        isInitializing = false; 
        highlightAndEmit(realIdx, true); 
    }, 300);
  });

  // 初始化定位
  const initRealIdx = Math.max(0, values.indexOf(initialValue));
  setTimeout(()=> {
    scrollToRealIdx(initRealIdx, false); // 瞬間定位，不滑動
    // ★ 延遲解開鎖定，確保初始化捲動結束後才開始監聽
    setTimeout(()=>{ isInitializing = false; }, 200);
  }, 0);
}

// ====== 與後端互動 (Apps Script) ======
const API_BASE = "https://script.google.com/macros/s/AKfycbwy1VKGICqMwjax01HpCvYChWOuJW0H448qP9bSzJ--v9yYD8wbYrCR9aT5vYkjLBlYow/exec";

async function apiLoadRows(){
  const r = await fetch(API_BASE);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "load failed");
  
  if (j.catalog && Object.keys(j.catalog).length > 0) {
    CATALOG = j.catalog;
    // 這裡不直接呼叫 render，避免初始載入時重複渲染
  }

  const rows = j.rows || [];

  return rows.map(row => {
    const d = new Date(row["日期"]);
    const logicalDate = new Date(d);
    if (logicalDate.getHours() < 7) {
      logicalDate.setDate(logicalDate.getDate() - 1);
    }
    row._dateStr = ymd(logicalDate);
    return row;
  });
}

async function apiAppendRows(rows){
  const r = await fetch(API_BASE, {
    method: "POST",
    body: JSON.stringify({ rows: rows }), 
  });
  
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "append failed");
  return j.appended || 0;
}

async function reloadFromBackend(){
  importedRows = await apiLoadRows();
  renderRecordsFilters(importedRows);
  renderRecordsTable();
  renderBottomNav(); // 確保 Catalog 更新後重繪導覽
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

// ====== Main Page Logic ======
function createBlock(part = currentPart, actionIdx = 0){
  const b = { id:idCounter++, part, actionIdx, ended:false, temp:{reps:10, weight:0}, sets:[], activeSetIdx:null };
  blocks.push(b);
  return b;
}
function getActiveBlock(){
  for (let i = blocks.length - 1; i >= 0; i--) if (!blocks[i].ended) return blocks[i];
  return createBlock();
}

function renderMain(){
  appRoot.innerHTML = "";
  blocks.forEach((b) => {
    const node = renderBlock(b);
    appRoot.appendChild(node);
  });
  renderBottomNav();
  renderActionNav();
}

function renderBlock(b){
  const wrap = el("section","block" + (b.ended ? " disabled" : ""));
  const left = el("div","left card");
  left.append(el("div")); 

  let listWrap; 
  let hint;

  const head = el("div","summary");
  const headLeft = el("div");
  // 防呆：如果 CATALOG 裡沒這個 key，就給個預設顯示
  const catData = CATALOG[b.part] || { label: b.part, exercises: [] };
  
  const tag = el("span","tag", catData.label);
  const hname = el("span","hname", catData.exercises[b.actionIdx] || "");
  const sText = el("div","text");

  const headRight = el("div","actions");
  const nextBtn = el("button","btn btn-primary","完成這一組");
  const endBtn  = el("button","btn btn-danger","下一個動作");
  headRight.append(nextBtn, endBtn);

  headLeft.append(tag, hname);
  head.append(headLeft, sText, headRight);
  left.append(head);

  const pickerWrap = el("div","picker");
  const colW = el("div","col");
  colW.append(el("div","lab","重量"));
  const wheelW = el("div","wheel");      
  colW.append(wheelW, el("div","lab2","lb"));
  const colR = el("div","col");
  colR.append(el("div","lab","幾下"));
  const wheelR = el("div","wheel");      
  colR.append(wheelR, el("div","lab2","下"));

  pickerWrap.append(colW, colR);
  left.append(pickerWrap);

  const right = el("div","right card");
  right.append(el("div","title","本動作紀錄（最多 4 組）"));
  listWrap = el("ul","set-list");   
  right.append(listWrap);
  hint = el("div","hint");
  right.append(hint);

  const updateSummary = ()=>{
    if (b.ended){ sText.textContent=""; return; }
    const src  = (b.activeSetIdx===null) ? b.temp : b.sets[b.activeSetIdx];
    let idx    = (b.activeSetIdx===null) ? (b.sets.length+1) : (b.activeSetIdx+1);
    const kg = Number(src.weight)||0;
    const lb = kgToNearestLbStep(kg);
    sText.textContent = (idx>MAX_SETS)
      ? "已完成四組"
      : `${lb} lb (${kg} kg) · ${src.reps} 下 · 第 ${idx} 組`;
  };

  function rebuildWheels(){                          
    const editingExisting = b.activeSetIdx !== null;
    const src = editingExisting ? b.sets[b.activeSetIdx] : b.temp;
    const lbValues = []; for (let lb=0; lb<=LB_MAX; lb+=LB_STEP) lbValues.push(lb);
    const initLb = kgToNearestLbStep(Number(src.weight)||0);

    buildWheel(wheelW, lbValues, initLb, (valLb)=>{
      const valKg = Math.round(lbToKg(valLb)*10)/10;
      if (b.activeSetIdx===null) b.temp.weight = valKg;
      else b.sets[b.activeSetIdx].weight = valKg;
      updateSummary(); renderSetList(listWrap, b);
    });
    buildWheel(wheelR, rangeArray(1,20,1), Number(src.reps)||10, (val)=>{
      if (b.activeSetIdx===null) b.temp.reps = val;
      else b.sets[b.activeSetIdx].reps = val;
      updateSummary(); renderSetList(listWrap, b);
    });
  }
  rebuildWheels();                                   

  function refreshButtons(){
    const onlyOnGhost = (b.activeSetIdx === null);
    const full = b.sets.length >= MAX_SETS;
    nextBtn.disabled = b.ended || !onlyOnGhost || full;
    nextBtn.textContent = full ? "已完成四組" : "完成這一組";
    const hasAnySet = b.sets.length > 0;
    endBtn.disabled = b.ended || !onlyOnGhost || !hasAnySet;
  }

  function renderSetList(container, bRef){
    container.innerHTML = "";
    const full = bRef.sets.length >= MAX_SETS;

    // 1. 如果沒有任何組數 (Ghost State)
    if (bRef.sets.length===0){
      const ghost = el("li","set-item ghost"+(bRef.activeSetIdx===null?" active":"" ));
      ghost.append(el("div","badge","第 1 組"));
      ghost.append(el("div","sline", fmtSetLine(bRef.temp)));
      ghost.addEventListener("click", ()=>{
        bRef.activeSetIdx = null;
        rebuildWheels(); updateSummary(); renderSetList(container, bRef); refreshButtons();
      });
      container.append(ghost);
      hint.textContent = "調整數值後按「完成這一組」開始。";
      return;
    }

    // 2. 渲染已存在的組數
    hint.textContent = "";
    bRef.sets.slice(0, MAX_SETS).forEach((s, idx)=>{
      const li = el("li","set-item"+(idx===bRef.activeSetIdx?" active":""));
      
      // 左側內容區 (點擊切換編輯)
      const infoDiv = el("div", "set-info");
      infoDiv.style.flex = "1"; // 佔滿剩餘空間
      infoDiv.append(el("div","badge",`第 ${idx+1} 組`), el("div","sline", fmtSetLine(s)));
      infoDiv.addEventListener("click", ()=>{
        bRef.activeSetIdx = idx;
        rebuildWheels(); updateSummary(); renderSetList(container, bRef); refreshButtons();
      });

      // ★ 右側刪除按鈕
      const delBtn = el("button", "del-btn", "✕"); // 用乘號當叉叉
      delBtn.title = "刪除此組";
      delBtn.addEventListener("click", (e)=>{
        e.stopPropagation(); // 阻止冒泡，避免觸發編輯
        if(confirm(`確定刪除第 ${idx+1} 組嗎？`)){
          bRef.sets.splice(idx, 1); // 刪除資料
          bRef.activeSetIdx = null; // 重置編輯狀態，避免錯亂
          // 如果刪光了，把 temp 重置為最後一筆或預設
          if(bRef.sets.length > 0) {
             const last = bRef.sets[bRef.sets.length-1];
             bRef.temp = { ...last };
          }
          rebuildWheels(); updateSummary(); renderSetList(container, bRef); refreshButtons();
        }
      });

      li.append(infoDiv, delBtn); // 注意這裡結構變了
      container.append(li);
    });

    // 3. 預備下一組 (Ghost State)
    if (!full && !bRef.ended){
      const idx = bRef.sets.length;
      const ghost = el("li","set-item ghost"+(bRef.activeSetIdx===null?" active":"" ));
      ghost.append(el("div","badge",`第 ${idx+1} 組`), el("div","sline", fmtSetLine(bRef.temp)));
      ghost.addEventListener("click", ()=>{
        bRef.activeSetIdx = null;
        rebuildWheels(); updateSummary(); renderSetList(container, bRef); refreshButtons();
      });
      container.append(ghost);
    }
  }

  updateSummary();
  refreshButtons();
  renderSetList(listWrap, b);

  nextBtn.addEventListener("click", ()=>{
    if (b.ended) return;
    if (b.sets.length >= MAX_SETS) return;
    const src = (b.activeSetIdx===null) ? b.temp : b.sets[b.activeSetIdx];
    b.sets.push({ reps: src.reps, weight: src.weight });
    b.temp = { reps: src.reps, weight: src.weight };
    b.activeSetIdx = null;
    rebuildWheels(); updateSummary(); renderSetList(listWrap, b); refreshButtons();
  });

  endBtn.addEventListener("click", ()=>{
    if (b.ended) return;
    b.ended = true;
    wrap.classList.add("disabled");
    updateSummary();
    createBlock(currentPart, 0);
    const nb = getActiveBlock();
    const partZh = CATALOG[nb.part]?.label || nb.part;
    const name   = CATALOG[nb.part]?.exercises[nb.actionIdx] || "";
    const last   = getLastDefaultsFromCsv(partZh, name);
    nb.temp = { reps:last.reps, weight:last.weight };
    renderMain();
  });

  wrap.append(left, right);
  return wrap;
}

function renderBottomNav(){
  bottomNav.innerHTML = "";
  Object.entries(CATALOG).forEach(([k,v])=>{
    const btn = el("button","nav-btn"+(k===currentPart?" active":""), v.label);
    btn.addEventListener("click",()=>{
      currentPart = k;
      
      const b = getActiveBlock();
      if(b.sets.length > 0) {
        b.ended = true;
        const allBlocks = document.querySelectorAll('.block');
        const lastBlockNode = allBlocks[allBlocks.length-1];
        if(lastBlockNode) lastBlockNode.classList.add('disabled');
        createBlock(currentPart, 0);
      } else {
        b.part = currentPart;
        b.actionIdx = 0;
      }

      const nb = getActiveBlock();
      const partZh = CATALOG[nb.part]?.label || nb.part;
      const name   = CATALOG[nb.part]?.exercises[nb.actionIdx] || "";
      const last   = getLastDefaultsFromCsv(partZh, name);
      nb.temp = { reps:last.reps, weight:last.weight };
      
      renderActionNav();
      renderMain();
    });
    bottomNav.append(btn);
  });
}

function renderActionNav(){
  actionNav.innerHTML = "";
  const catData = CATALOG[currentPart];
  if(!catData) return; // 防呆

  const list = catData.exercises;
  const activeBlock = getActiveBlock();
  
  list.forEach((name, i)=>{
    const chip = el("div","action-chip"+(i===activeBlock.actionIdx?" active":""), name);
    chip.addEventListener("click",()=>{
      const b = getActiveBlock();
      b.part = currentPart;
      b.actionIdx = i;
      const partZh = CATALOG[b.part].label;
      const nm   = CATALOG[b.part].exercises[b.actionIdx] || "";
      const last = getLastDefaultsFromCsv(partZh, nm);
      b.temp = { reps:last.reps, weight:last.weight };
      renderMain();
    });
    actionNav.append(chip);
  });
}

// ====== Export / Write to Excel ======
function blockToRow(b, dateStr){
  const part = CATALOG[b.part]?.label || b.part;
  const action = CATALOG[b.part]?.exercises[b.actionIdx] || "";
  const reps = [0,0,0,0], wts = [0,0,0,0];
  b.sets.slice(0,4).forEach((s,i)=>{ reps[i]=s.reps||0; wts[i]=s.weight||0; });
  return { "日期":dateStr,"部位":part,"動作":action,
    "組1":reps[0],"組2":reps[1],"組3":reps[2],"組4":reps[3],
    "重1":wts[0],"重2":wts[1],"重3":wts[2],"重4":wts[3] };
}
function collectTodayRows(){
  const nowISO = new Date().toISOString(); 
  return blocks.filter(b=>b.sets.length>0).map(b=>blockToRow(b, nowISO));
}
function fillExportTable(rows){
  exportTbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    ["日期","部位","動作","組1","組2","組3","組4","重1","重2","重3","重4"].forEach(k=>{
      const td = document.createElement("td"); td.textContent = r[k]; tr.appendChild(td);
    });
    exportTbody.appendChild(tr);
  });
}

function resetMainFromCsv(){
  blocks.length = 0;
  createBlock(currentPart, 0);
  const b = getActiveBlock();
  const partZh = CATALOG[b.part]?.label || b.part;
  const name   = CATALOG[b.part]?.exercises[b.actionIdx] || "";
  const last   = getLastDefaultsFromCsv(partZh, name);
  b.temp = { reps: last.reps, weight: last.weight };
  renderMain();
}

finishDayBtn?.addEventListener("click", ()=>{
  const rows = collectTodayRows();
  if (!rows.length){ alert("尚未有任何組數紀錄。"); return; }
  fillExportTable(rows);
  exportPanel.classList.remove("hidden");
});
closeExportBtn?.addEventListener("click", ()=> exportPanel.classList.add("hidden"));

confirmAppendBtn?.addEventListener("click", async ()=>{
  confirmAppendBtn.disabled = true;
  confirmAppendBtn.textContent = "同步中...";

  try{
    const rows = collectTodayRows();
    if (!rows.length){ alert("尚未有任何組數紀錄。"); confirmAppendBtn.disabled=false; return; }

    const appended = await apiAppendRows(rows); 
    
    await reloadFromBackend(); 

    exportPanel.classList.add("hidden");
    resetMainFromCsv();

    tabs.forEach(t => t.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="records"]')?.classList.add("active");
    
    Object.values(pages).forEach(p => p.classList.remove("show"));
    pages.records.classList.add("show");
    
    renderRecordsTable(); 

    alert(`同步成功！已儲存 ${appended} 筆紀錄。`);

  }catch(e){
    console.error(e);
    alert("同步發生異常 (若 Google Sheet 已有資料請忽略)。\n" + e.message);
  } finally {
    confirmAppendBtn.disabled = false;
    confirmAppendBtn.textContent = "完成";
  }
});

clearAll?.addEventListener("click", resetMainFromCsv);

// ====== Records Filter ======
function renderRecordsFilters(rows){
  renderRecordsPartChips(rows);
  renderRecordsActionChips(rows);
}

function renderRecordsPartChips(){
  const parts = [...new Set((importedRows||[]).map(r=>r["部位"]).filter(Boolean))];
  recordsPartRow.innerHTML = "";

  const allBtn = el("button","chip"+(recFilterPart===""?" active":""),"全部部位");
  allBtn.addEventListener("click", ()=>{
    recFilterPart = "";
    recFilterAction = "";       
    renderRecordsPartChips();
    renderRecordsActionChips();
    renderRecordsTable();
  });
  recordsPartRow.append(allBtn);

  parts.forEach(p=>{
    const btn = el("button","chip"+(recFilterPart===p?" active":""), p);
    btn.addEventListener("click", ()=>{
      recFilterPart = p;
      recFilterAction = "";    
      renderRecordsPartChips();
      renderRecordsActionChips();
      renderRecordsTable();
    });
    recordsPartRow.append(btn);
  });
}

function renderRecordsActionChips(){
  recordsActionRow.innerHTML = "";
  let pool = (importedRows||[]);
  if (recFilterPart) pool = pool.filter(r=>r["部位"]===recFilterPart);

  const actions = [...new Set(pool.map(r=>r["動作"]).filter(Boolean))];

  if (!recFilterPart){
    const tip = el("div","muted","請先選擇上方的部位");
    recordsActionRow.append(tip);
    return;
  }

  const allBtn = el("button","chip"+(recFilterAction===""?" active":""),"全部動作");
  allBtn.addEventListener("click", ()=>{
    recFilterAction = "";
    renderRecordsActionChips();
    renderRecordsTable();
  });
  recordsActionRow.append(allBtn);

  actions.forEach(a=>{
    const btn = el("button","chip"+(recFilterAction===a?" active":""), a);
    btn.addEventListener("click", ()=>{
      recFilterAction = a;
      renderRecordsActionChips();
      renderRecordsTable();
    });
    recordsActionRow.append(btn);
  });
}

function renderRecordsTable(){
  let rows = Array.isArray(importedRows) ? [...importedRows] : [];

  if (recFilterPart)   rows = rows.filter(r => r["部位"] === recFilterPart);
  if (recFilterAction) rows = rows.filter(r => r["動作"] === recFilterAction);

  rows.sort((a,b)=> (a["日期"] < b["日期"] ? 1 : (a["日期"] > b["日期"] ? -1 : 0)));

  recordsTbody.innerHTML = "";
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    const cols = ["日期","部位","動作","組1","組2","組3","組4","重1","重2","重3","重4"];
    cols.forEach(k=>{
      const td = document.createElement("td");
      if (k.startsWith("重")){
        const kg = Number(r[k])||0;
        const lb = kgToNearestLbStep(kg);
        td.textContent = `${kg} kg (${lb} lb)`;
      } else if (k === "日期") {
        const raw = r["日期"] || "";
        const clean = r._dateStr || raw.split("T")[0];
        td.textContent = clean;
      } else {
        td.textContent = r[k] ?? "";
      }
      tr.appendChild(td);
    });
    recordsTbody.appendChild(tr);
  });
}


// ====== Calendar ======
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
    const raw = r["日期"] || "";
    const dStr = r._dateStr || raw.split("T")[0].replace(/-/g, '/');
    if (!dStr) return;
    (partsByDate[dStr] = partsByDate[dStr] || new Set()).add(r["部位"]);
  });

  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();

  monthLabel.textContent = `${y}/${String(m+1).padStart(2,"0")}`;
  calendarGrid.innerHTML = "";

  const total = 42;
  for (let i=0;i<total;i++){
    const cell = el("div","day");
    const dayNum = i - startDow + 1;
    if (dayNum > 0 && dayNum <= daysInMonth){
      const dateStr = ymd(new Date(y, m, dayNum));
      cell.append(el("div","d", String(dayNum)));
      
      const badges = el("div","badges");
      const parts = Array.from(partsByDate[dateStr] || []);
      parts.forEach(p=>{
        const dotCls = partDotClass(p);
        const b = el("div","badge");
        const dot = el("span",`dot ${dotCls}`);
        b.append(dot); 
        badges.append(b);
      });
      cell.append(badges);

      cell.addEventListener("click", ()=>{
        selectedCalDate = dateStr;
        renderCalendar();
        renderCalendarDetails();
      });

      if (selectedCalDate === dateStr) cell.classList.add("selected");
    }
    calendarGrid.append(cell);
  }
  
  renderCalendarDetails();
}

function renderCalendarDetails(){
  calSideList.innerHTML = "";
  if (!selectedCalDate){
    calSideTitle.textContent = "選擇日期查看詳情";
    return;
  }
  calSideTitle.textContent = selectedCalDate;

  const rows = (importedRows || []).filter(r => r._dateStr === selectedCalDate);

  if (rows.length === 0){
    const li = el("li","side-item");
    li.textContent = "這一天沒有紀錄";
    calSideList.append(li);
    return;
  }

  rows.forEach(r=>{
    const li = el("li","side-item");
    const top = el("div","si-top");
    top.append(el("span","", `${r["部位"]} · ${r["動作"]}`));
    li.append(top);

    const detail = el("div","si-sub");
    const reps = [r["組1"], r["組2"], r["組3"], r["組4"]].map(n => Number(n)||0);
    const wkg  = [r["重1"], r["重2"], r["重3"], r["重4"]].map(n => Number(n)||0);
    
    for (let i=0;i<4;i++){
      if (reps[i] || wkg[i]){
        const lb = kgToNearestLbStep(wkg[i]);
        const line = el("div","si-line", `${reps[i]} 下  @  ${lb} lb (${wkg[i]} kg)`);
        detail.append(line);
      }
    }
    li.append(detail);
    calSideList.append(li);
  });
}

prevMonthBtn?.addEventListener("click", ()=>{ calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1, 1); renderCalendar(); });
nextMonthBtn?.addEventListener("click", ()=>{ calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1, 1); renderCalendar(); });

// ====== Settings Editor Logic ======
function renderEditor(){
  if(!editorContainer) return;
  editorContainer.innerHTML = "";
  
  Object.entries(CATALOG).forEach(([key, val]) => {
    const box = el("div", "edit-group");
    
    // 標題與刪除部位按鈕
    const head = el("div", "eg-head");
    head.innerHTML = `<strong>${val.label}</strong> <span style="font-size:0.8em;opacity:0.6">(${key})</span>`;
    
    const delPartBtn = el("button", "btn btn-danger btn-sm", "刪除部位");
    delPartBtn.onclick = () => {
      if(confirm(`確定刪除「${val.label}」及其所有動作？`)) {
        delete CATALOG[key];
        renderEditor();
      }
    };
    head.appendChild(delPartBtn);
    box.appendChild(head);

    // 動作列表
    const ul = el("ul", "eg-list");
    val.exercises.forEach((ex, idx) => {
      const li = el("li", "eg-item");
      li.innerHTML = `<span>${ex}</span>`;
      const delExBtn = el("button", "btn btn-danger btn-sm", "×");
      delExBtn.onclick = () => {
        val.exercises.splice(idx, 1);
        renderEditor();
      };
      li.appendChild(delExBtn);
      ul.appendChild(li);
    });
    box.appendChild(ul);

    // 新增動作
    const addRow = el("div", "eg-add-row");
    const input = el("input", "eg-input");
    input.placeholder = "輸入新動作...";
    const addBtn = el("button", "btn btn-primary btn-sm", "新增");
    
    const doAdd = () => {
      if(input.value.trim()){
        val.exercises.push(input.value.trim());
        renderEditor();
      }
    };
    addBtn.onclick = doAdd;
    input.onkeydown = (e) => { if(e.key==="Enter") doAdd(); };

    addRow.append(input, addBtn);
    box.appendChild(addRow);
    
    editorContainer.appendChild(box);
  });

  // 最下方：新增全新部位
  const newPartBox = el("div", "edit-group new-part-box");
  newPartBox.innerHTML = `<div class="eg-head"><strong>＋ 新增一個部位類別</strong></div>`;
  const npRow = el("div", "eg-add-row");
  
  const keyInput = el("input", "eg-input"); keyInput.placeholder = "ID (英文,如 legs)";
  const labelInput = el("input", "eg-input"); labelInput.placeholder = "顯示名稱 (如 臀腿)";
  const npBtn = el("button", "btn btn-primary btn-sm", "新增");
  
  npBtn.onclick = () => {
    const k = keyInput.value.trim();
    const l = labelInput.value.trim();
    if(k && l){
      if(CATALOG[k]) { alert("這個 ID 已經存在了"); return; }
      CATALOG[k] = { label: l, exercises: [] };
      renderEditor();
    } else {
      alert("請輸入 ID (英文) 與 顯示名稱");
    }
  };
  npRow.append(keyInput, labelInput, npBtn);
  newPartBox.appendChild(npRow);
  editorContainer.appendChild(newPartBox);
}

// 綁定設定頁儲存按鈕
saveCatalogBtn?.addEventListener("click", async () => {
  saveCatalogBtn.disabled = true;
  saveCatalogBtn.textContent = "儲存中...";
  try {
    const r = await fetch(API_BASE, {
      method: "POST",
      body: JSON.stringify({ type: "config", catalog: CATALOG }), 
    });
    const j = await r.json();
    if(j.ok) {
      alert("設定已儲存！");
      renderBottomNav();
      renderActionNav();
    } else {
      alert("儲存失敗：" + j.error);
    }
  } catch(e) {
    alert("連線錯誤");
    console.error(e);
  }
  saveCatalogBtn.disabled = false;
  saveCatalogBtn.textContent = "儲存變更到雲端";
});


// ====== Tabs Switching ======
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.values(pages).forEach(p=>p?.classList.remove("show"));
    
    if(pages[tab]) pages[tab].classList.add("show");
    
    // 如果是設定頁，確保 container 顯示
    if(tab === "settings") {
      document.getElementById("page-settings")?.classList.add("show");
      renderEditor();
    }

    if (tab === "calendar") { renderCalendarWeekdays(); renderCalendar(); }
    if (tab === "records")  { renderRecordsTable(); }
  });
});

// ====== Init ======
(async function init(){
  try { 
      // 1. 先讀取後端 (這裡面會呼叫 renderBottomNav)
      await reloadFromBackend(); 
  } catch(e){ 
      console.warn("後端連線中...", e); 
  }
  
  renderCalendarWeekdays();

  // ★ 修正邏輯：先清空，確保乾淨
  blocks.length = 0; 
  idCounter = 1;

  // 2. 建立「唯一」的一張初始卡片
  createBlock(currentPart, 0);
  
  // 3. 帶入預設值
  const b = getActiveBlock();
  const partZh = CATALOG[b.part]?.label || b.part;
  const name   = CATALOG[b.part]?.exercises[b.actionIdx] || "";
  const last   = getLastDefaultsFromCsv(partZh, name);
  b.temp = { reps:last.reps, weight:last.weight };

  // 4. 最後再一次性渲染
  await renderRecordsFilters(importedRows); // 確保 filter 有東西
  renderRecordsTable();
  renderMain();
})();