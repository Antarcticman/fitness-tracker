// ====== Catalog（依你提供的影片動作） ======
const CATALOG = {
  chest: {
    label: "胸",
    exercises: ["啞鈴臥推", "啞鈴上斜臥推", "啞鈴下斜臥推", "啞鈴飛鳥"],
  },
  back: {
    label: "背",
    exercises: ["俯身划船", "單臂划船", "上斜划船", "(輔)仰臥直臂上拉"],
  },
  legs: {
    label: "臀腿",
    exercises: [
      "高腳杯深蹲",
      "啞鈴硬拉",
      "啞鈴直腿硬拉",
      "保加利亞單腿蹲",
      "啞鈴臀橋",
      "(輔)啞鈴單腿提踵",
    ],
  },
  shoulder: {
    label: "肩",
    exercises: [
      "啞鈴推舉",
      "阿諾德推舉",
      "啞鈴側平舉",
      "俯身啞鈴側平舉",
      "(輔)啞鈴過頂前平舉",
    ],
  },
  biceps: {
    label: "肱二頭",
    exercises: ["啞鈴彎舉", "上斜啞鈴彎舉", "啞鈴斜托彎舉", "集中彎舉"],
  },
  triceps: {
    label: "肱三頭",
    exercises: ["頸後啞鈴臂屈伸", "俯身臂屈伸", "鑽石啞鈴臥推"],
  },
  forearm: {
    label: "前臂",
    exercises: ["啞鈴錘式彎舉", "背後腕彎舉"],
  },
  core: {
    label: "核心",
    exercises: ["負重卷腹", "啞鈴傳遞", "抱石"],
  },
};

const MAX_SETS = 4; // 每動作最多四組

// ====== 狀態（主頁） ======
let currentPart = "chest";
const blocks = []; // [{id, part, actionIdx, ended, temp:{reps,weight}, sets:[{reps,weight}], activeSetIdx}]
let idCounter = 1;

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

// Tabs & Pages
const tabs = [...document.querySelectorAll(".tab-btn")];
const pages = {
  main: document.getElementById("page-main"),
  calendar: document.getElementById("page-calendar"),
  records: document.getElementById("page-records"),
};

// Records page
const recordsPartChips   = document.getElementById("recordsPartChips");
const recordsActionChips = document.getElementById("recordsActionChips");
const recordsPartRow   = document.getElementById("recordsPartChips");
const recordsActionRow = document.getElementById("recordsActionChips");
let recFilterPart = "";   // 儲存 chips 選擇
let recFilterAction = "";

const recordsTbody   = document.getElementById("recordsTbody");

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
// 07:00 之前都算「前一天」
const ymdWithCutoff = (d, cutoffHour=7)=>{
  const dd = new Date(d);
  if (dd.getHours() < cutoffHour){
    dd.setDate(dd.getDate() - 1);
  }
  return `${dd.getFullYear()}/${String(dd.getMonth()+1).padStart(2,"0")}/${String(dd.getDate()).padStart(2,"0")}`;
};

const fmtSetLine = s => {
  const kg = Number(s.weight)||0;
  const lb = kgToNearestLbStep(kg);
  return `${lb} lb (${kg} kg) · ${s.reps} 下`;
};

// ===== 轉盤工具（讓首尾也能置中） =====
function rangeArray(min, max, step=1){
  const out = [];
  for (let v=min; v<=max; v+=step) out.push(v);
  return out;
}

const ITEM_H = 44;     // 與 CSS .opt 高度一致
const WHEEL_H = 140;   // 與 CSS .wheel 高度一致
const SPACER_COUNT = 1; // 頂/底各 1 個 spacer

// === 單位設定 ===
const LB_STEP = 2.5;       // 2.5 磅一格
const LB_MAX  = 60;       // 你可依啞鈴上限調整（例如 52.5、80、100）
const KG_PER_LB = 0.45359237;

// 換算
const lbToKg = (lb)=> lb * KG_PER_LB;
const kgToLb = (kg)=> kg / KG_PER_LB;

// 以「公斤」→ 轉成「最接近的磅(以 2.5 為步進)」
function kgToNearestLbStep(kg){
  const KG_PER_LB = 0.45359237;
  const LB_STEP = 2.5;
  const lb = kg / KG_PER_LB;
  return Math.round(lb / LB_STEP) * LB_STEP;
}


/**
 * 建立輪盤內容到 elem：
 * - 頂/底各加入隱藏 spacer，讓第一/最後值可置中
 * - values: 數值陣列，如 [0..30] 或 [1..20]
 * - initialValue: 初始選中值
 * - onChange: (val:number) => void
 */
function buildWheel(elem, values, initialValue, onChange){
  elem.innerHTML = "";

  // 頂部 spacer
  for (let i=0;i<SPACER_COUNT;i++){
    const sp = document.createElement("div");
    sp.className = "opt spacer";
    sp.textContent = "-1";
    elem.appendChild(sp);
  }
  // 真實選項
  values.forEach(v=>{
    const d = document.createElement("div");
    d.className = "opt";
    d.dataset.value = v;
    d.textContent = v;
    elem.appendChild(d);
  });
  // 底部 spacer
  for (let i=0;i<SPACER_COUNT;i++){
    const sp = document.createElement("div");
    sp.className = "opt spacer";
    sp.textContent = "-1";
    elem.appendChild(sp);
  }

  const children = [...elem.children];

  const highlightAndEmit = (realIdx)=>{
    children.forEach(c=>c.classList.remove("active"));
    const childIdx = realIdx + SPACER_COUNT;
    const el = children[childIdx];
    if (el){
      el.classList.add("active");
      onChange?.(Number(values[realIdx]));
    }
  };
  const scrollToRealIdx = (realIdx, smooth=true)=>{
    const childIdx = realIdx + SPACER_COUNT;
    const targetTop = childIdx * ITEM_H + (ITEM_H/2 - elem.clientHeight/2);
    elem.scrollTo({ top: Math.max(0, targetTop), behavior: smooth ? "smooth" : "auto" });
    highlightAndEmit(realIdx);
  };

  // 捲動後吸附為最近一格
  let timer = null;
  elem.addEventListener("scroll", ()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>{
      const center = elem.scrollTop + elem.clientHeight/2;
      let childIdx = Math.round(center / ITEM_H - 0.5);
      let realIdx = childIdx - SPACER_COUNT;
      realIdx = Math.min(Math.max(realIdx, 0), values.length - 1);
      scrollToRealIdx(realIdx);
    }, 80);
  });

  // 點選即吸附
  elem.addEventListener("click",(e)=>{
    const opt = e.target.closest(".opt");
    if (!opt) return;
    const childrenArr = [...elem.children];
    const childIdx = childrenArr.indexOf(opt);
    let realIdx = childIdx - SPACER_COUNT;
    realIdx = Math.min(Math.max(realIdx, 0), values.length - 1);
    scrollToRealIdx(realIdx);
  });

  // 初始化定位
  const initRealIdx = Math.max(0, values.indexOf(initialValue));
  setTimeout(()=> {
    const childIdx = initRealIdx + SPACER_COUNT;
    const initTop = childIdx * ITEM_H + (ITEM_H/2 - WHEEL_H/2);
    elem.scrollTop = Math.max(0, initTop);
    highlightAndEmit(initRealIdx);
  }, 0);
}

function timecodeToSeconds(tc){
  if (!tc) return 0;
  const parts = tc.split(":").map(x=>parseInt(x,10)||0);
  if (parts.length === 3){
    const [a,b,c] = parts;
    if (a < 60) return a*60 + b; // 視為 mm:ss:00
    return a*3600 + b*60 + c;
  }
  if (parts.length === 2){ const [m,s]=parts; return m*60 + s; }
  return parts[0] || 0;
}

// ====== 與後端互動（Google Sheets via Apps Script） ======

// 請將下方的網址換成你在第一階段最後複製的那串 Web App URL
const API_BASE = "https://script.google.com/macros/s/AKfycbwy1VKGICqMwjax01HpCvYChWOuJW0H448qP9bSzJ--v9yYD8wbYrCR9aT5vYkjLBlYow/exec";

async function apiLoadRows(){
  // GAS 的 doGet 預設就是 GET 請求
  const r = await fetch(API_BASE);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "load failed");
  return j.rows || [];
}

async function apiAppendRows(rows){
  // 傳送資料到 GAS 的 doPost
  // 注意：CORS 跨域請求在 GAS 上很嚴格，這裡用 "text/plain" 避開 Preflight check
  // 雖然我們送的是 JSON 字串，但告訴瀏覽器這是純文字，GAS 那邊再 JSON.parse
  const r = await fetch(API_BASE, {
    method: "POST",
    body: JSON.stringify({ rows: rows }), 
    // 不設定 header，或者設為 text/plain，這是連線 GAS 的標準做法
  });
  
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "append failed");
  return j.appended || 0;
}

// 這裡不需要改，保持原樣即可
async function reloadFromBackend(){
  importedRows = await apiLoadRows();
  renderRecordsFilters(importedRows);
  renderRecordsTable();
}

// 從 importedRows 找相同【部位＋動作】的最後一筆，抓最後非 0 的(重,次)；找不到→ {0,10}
function getLastDefaultsFromCsv(partZh, actionName){
  if (!Array.isArray(importedRows) || importedRows.length === 0) return { weight:0, reps:10 };
  const rows = importedRows.filter(r => r["部位"] === partZh && r["動作"] === actionName);
  if (!rows.length) return { weight:0, reps:10 };
  rows.sort((a,b)=> (a["日期"] > b["日期"] ? 1 : -1)); // 假設 YYYY/MM/DD
  const last = rows[rows.length - 1];
  for (let i = 4; i >= 1; i--){
    const reps = Number(last[`組${i}`] || 0);
    const wt   = Number(last[`重${i}`] || 0);
    if (reps > 0 || wt > 0) return { weight: wt, reps: (reps || 10) };
  }
  return { weight:0, reps:10 };
}

// ====== Main Page：Blocks ======
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
  left.append(el("div")); // 你的 title 如果要可保留

  // 先準備右側需要用到的變數（避免 TDZ）
  let listWrap; 
  let hint;

  // ---- 抬頭 + 目前資訊 + 右側按鈕 ----
  const head = el("div","summary");
  const headLeft = el("div");
  const tag = el("span","tag", CATALOG[b.part].label);
  const hname = el("span","hname", CATALOG[b.part].exercises[b.actionIdx] || "");
  const sText = el("div","text");

  const headRight = el("div","actions");
  const nextBtn = el("button","btn btn-primary","完成這一組");
  const endBtn  = el("button","btn btn-danger","下一個動作");
  headRight.append(nextBtn, endBtn);

  headLeft.append(tag, hname);
  head.append(headLeft, sText, headRight);
  left.append(head);

  // 轉盤區（建立再呼叫）
  const pickerWrap = el("div","picker");
  // 重量（左）
  const colW = el("div","col");
  colW.append(el("div","lab","重量"));
  const wheelW = el("div","wheel");      // ← 先建立
  colW.append(wheelW, el("div","lab2","lb"));
  // 幾下（右）
  const colR = el("div","col");
  colR.append(el("div","lab","幾下"));
  const wheelR = el("div","wheel");      // ← 先建立
  colR.append(wheelR, el("div","lab2","下"));

  pickerWrap.append(colW, colR);
  left.append(pickerWrap);

  // ===== 右側（先建立，讓下面函式可以安全引用 listWrap）=====
  const right = el("div","right card");
  right.append(el("div","title","本動作紀錄（最多 4 組）"));
  listWrap = el("ul","set-list");   // ← 這裡賦值
  right.append(listWrap);
  hint = el("div","hint");
  right.append(hint);

  // ===== 下面才宣告會用到 listWrap 的函式 =====
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

  // ...（建立 wheelW / wheelR 容器）...
  function rebuildWheels(){                          // ← 先宣告
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
  rebuildWheels();                                   // ← 再呼叫

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

    hint.textContent = "";
    bRef.sets.slice(0, MAX_SETS).forEach((s, idx)=>{
      const li = el("li","set-item"+(idx===bRef.activeSetIdx?" active":""));
      li.append(el("div","badge",`第 ${idx+1} 組`), el("div","sline", fmtSetLine(s)));
      li.addEventListener("click", ()=>{
        bRef.activeSetIdx = idx;
        rebuildWheels(); updateSummary(); renderSetList(container, bRef); refreshButtons();
      });
      container.append(li);
    });

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

  // 右下按鈕行為（維持你的原本邏輯）
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
    const partZh = CATALOG[nb.part].label;
    const name   = CATALOG[nb.part].exercises[nb.actionIdx] || "";
    const last   = getLastDefaultsFromCsv(partZh, name);
    nb.temp = { reps:last.reps, weight:last.weight };
    renderMain();
  });

  wrap.append(left, right);
  return wrap;
}

// 下方「部位」列
function renderBottomNav(){
  bottomNav.innerHTML = "";
  Object.entries(CATALOG).forEach(([k,v])=>{
    const btn = el("button","nav-btn"+(k===currentPart?" active":""), v.label);
    btn.addEventListener("click",()=>{
      currentPart = k;
      const b = getActiveBlock();
      b.part = currentPart;
      b.actionIdx = 0; // 切部位預設第一個動作
      // 帶入 CSV 預設
      const partZh = CATALOG[b.part].label;
      const name   = CATALOG[b.part].exercises[b.actionIdx] || "";
      const last   = getLastDefaultsFromCsv(partZh, name);
      b.temp = { reps:last.reps, weight:last.weight };
      renderActionNav();
      renderMain();
    });
    bottomNav.append(btn);
  });
}

// 上方「動作」列
function renderActionNav(){
  actionNav.innerHTML = "";
  const list = CATALOG[currentPart].exercises;
  const activeBlock = getActiveBlock();
  list.forEach((name, i)=>{
    const chip = el("div","action-chip"+(i===activeBlock.actionIdx?" active":""), name);
    chip.addEventListener("click",()=>{
      const b = getActiveBlock();
      b.part = currentPart;
      b.actionIdx = i;
      // 帶入 CSV 預設
      const partZh = CATALOG[b.part].label;
      const nm   = CATALOG[b.part].exercises[b.actionIdx] || "";
      const last = getLastDefaultsFromCsv(partZh, nm);
      b.temp = { reps:last.reps, weight:last.weight };
      renderMain();
    });
    actionNav.append(chip);
  });
}

// ====== 匯出 / 寫入 Excel ======
function blockToRow(b, dateStr){
  const part = CATALOG[b.part].label;
  const action = CATALOG[b.part].exercises[b.actionIdx] || "";
  const reps = [0,0,0,0], wts = [0,0,0,0];
  b.sets.slice(0,4).forEach((s,i)=>{ reps[i]=s.reps||0; wts[i]=s.weight||0; });
  return { "日期":dateStr,"部位":part,"動作":action,
    "組1":reps[0],"組2":reps[1],"組3":reps[2],"組4":reps[3],
    "重1":wts[0],"重2":wts[1],"重3":wts[2],"重4":wts[3] };
}
function collectTodayRows(){
  const today = ymdWithCutoff(new Date(), 7); // 07:00 前算前一天
  return blocks.filter(b=>b.sets.length>0).map(b=>blockToRow(b, today));
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
  // 清掉所有 block
  blocks.length = 0;
  // 建一個新的 active block
  createBlock(currentPart, 0);
  const b = getActiveBlock();
  const partZh = CATALOG[b.part].label;
  const name   = CATALOG[b.part].exercises[b.actionIdx] || "";
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
  try{
    const rows = collectTodayRows();
    if (!rows.length){ alert("尚未有任何組數紀錄。"); return; }

    const appended = await apiAppendRows(rows);  // 寫入 Excel
    await reloadFromBackend();                   // 更新紀錄/日曆

    exportPanel.classList.add("hidden");

    // ★ 寫入成功後，自動清空主頁當日紀錄
    resetMainFromCsv();

    // 切到「紀錄」頁
    tabs.forEach(b=>b.classList.remove("active"));
    document
      .querySelector('.tab-btn[data-tab="records"]')
      ?.classList.add("active");
    Object.values(pages).forEach(p=>p.classList.remove("show"));
    pages.records?.classList.add("show");

    alert(`已完成寫入 Excel（${appended} 筆）。`);
  }catch(e){
    console.error(e);
    alert("寫入失敗，請確認本機後端 server.js 已啟動。");
  }
});

clearAll?.addEventListener("click", resetMainFromCsv);

// ====== Records：篩選與表格 ======
function unique(arr){ return [...new Set(arr)]; }

function buildActionOptionsForPart(partZh){
  let rows = importedRows || [];
  if (partZh) rows = rows.filter(r => r["部位"] === partZh);
  const actions = unique(rows.map(r => r["動作"]).filter(Boolean));
}

function renderRecordsFilters(rows){
  renderRecordsPartChips(rows);
  renderRecordsActionChips(rows);
}

// 產生「部位」chips
function renderRecordsPartChips(){
  const parts = [...new Set((importedRows||[]).map(r=>r["部位"]).filter(Boolean))];
  recordsPartRow.innerHTML = "";

  // 全部部位按鈕
  const allBtn = el("button","chip"+(recFilterPart===""?" active":""),"全部部位");
  allBtn.addEventListener("click", ()=>{
    recFilterPart = "";
    recFilterAction = "";           // 清空動作
    renderRecordsPartChips();
    renderRecordsActionChips();
    renderRecordsTable();
  });
  recordsPartRow.append(allBtn);

  parts.forEach(p=>{
    const btn = el("button","chip"+(recFilterPart===p?" active":""), p);
    btn.addEventListener("click", ()=>{
      recFilterPart = p;
      recFilterAction = "";         // 切部位時清空動作
      renderRecordsPartChips();
      renderRecordsActionChips();
      renderRecordsTable();
    });
    recordsPartRow.append(btn);
  });
}

// 產生「動作」chips（依目前部位）
function renderRecordsActionChips(){
  recordsActionRow.innerHTML = "";
  let pool = (importedRows||[]);
  if (recFilterPart) pool = pool.filter(r=>r["部位"]===recFilterPart);

  const actions = [...new Set(pool.map(r=>r["動作"]).filter(Boolean))];

  // 若未選部位，提示
  if (!recFilterPart){
    const tip = el("div","muted","請先選擇上方的部位");
    recordsActionRow.append(tip);
    return;
  }

  // 全部動作
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

  // 改用狀態值
  if (recFilterPart)   rows = rows.filter(r => r["部位"] === recFilterPart);
  if (recFilterAction) rows = rows.filter(r => r["動作"] === recFilterAction);

  // 最新在上（你的日期是 YYYY/MM/DD，可直接比較）
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
        td.textContent = `${kg} kg (${lb} lb)`;     // 顯示 kg + lb
      } else {
        td.textContent = r[k] ?? "";
      }
      tr.appendChild(td);
    });
    recordsTbody.appendChild(tr);
  });

  // 同步右側日曆（若有）
  renderCalendar();
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

  // 依日期聚合當天做過的部位集合
  const partsByDate = {};
  rows.forEach(r=>{
    const d = r["日期"]; if (!d) return;
    (partsByDate[d] = partsByDate[d] || new Set()).add(r["部位"]);
  });

  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

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
        const t = el("span","", p);
        b.append(dot,t);
        badges.append(b);
      });
      cell.append(badges);

      // 點擊：選取日期並渲染右側詳情
      cell.addEventListener("click", ()=>{
        selectedCalDate = dateStr;
        renderCalendar();          // 先重畫自己，做高亮
        renderCalendarDetails();   // 再畫右側
      });

      // 高亮目前選到的日期
      if (selectedCalDate === dateStr) cell.classList.add("selected");
    }
    calendarGrid.append(cell);
  }

  // 若第一次進來沒有選日期，預設選今天（若本月有今天）
  const todayStr = ymd(new Date());
  if (!selectedCalDate && todayStr.startsWith(`${y}/${String(m+1).padStart(2,"0")}`)){
    selectedCalDate = todayStr;
    renderCalendar(); // 只會跑一次
  }
}
function renderCalendarDetails(){
  calSideList.innerHTML = "";
  if (!selectedCalDate){
    calSideTitle.textContent = "選擇日期查看詳情";
    return;
  }
  calSideTitle.textContent = selectedCalDate;

  const rows = (importedRows || []).filter(r => r["日期"] === selectedCalDate);

  if (rows.length === 0){
    const li = el("li","side-item");
    li.textContent = "這一天沒有紀錄";
    calSideList.append(li);
    return;
  }

  rows.forEach(r=>{
    const li = el("li","side-item");

    // 標題列：部位 · 動作
    const top = el("div","si-top");
    top.append(el("span","", `${r["部位"]} · ${r["動作"]}`));
    li.append(top);

    // 明細列：每一組一行
    const detail = el("div","si-sub");
    const reps = [r["組1"], r["組2"], r["組3"], r["組4"]].map(n => Number(n)||0);
    const wkg  = [r["重1"], r["重2"], r["重3"], r["重4"]].map(n => Number(n)||0);
    const wlb  = wkg.map(kg => kgToNearestLbStep(kg));

    for (let i=0;i<4;i++){
      if (reps[i] || wkg[i]){
        const line = el("div","si-line", `${reps[i]} 下  @  ${wlb[i]} lb (${wkg[i]} kg)`);
        detail.append(line);
      }
    }
    li.append(detail);
    calSideList.append(li);
  });
}


prevMonthBtn?.addEventListener("click", ()=>{ calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1, 1); renderCalendar(); });
nextMonthBtn?.addEventListener("click", ()=>{ calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1, 1); renderCalendar(); });

// ====== Tabs ======
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.values(pages).forEach(p=>p.classList.remove("show"));
    pages[tab].classList.add("show");
    if (tab === "calendar") { renderCalendarWeekdays(); renderCalendar(); }
    if (tab === "records")  { renderRecordsTable(); }
  });
});

// ====== Init ======
(async function init(){
  try { await reloadFromBackend(); } catch(e){ console.warn("尚未啟動後端或 Excel 檔尚未建立", e); }
  renderCalendarWeekdays();

  createBlock(currentPart, 0);
  // 第一塊帶入上次紀錄
  const b = getActiveBlock();
  const partZh = CATALOG[b.part].label;
  const name   = CATALOG[b.part].exercises[b.actionIdx] || "";
  const last   = getLastDefaultsFromCsv(partZh, name);
  b.temp = { reps:last.reps, weight:last.weight };

  await reloadFromBackend();
  renderRecordsPartChips();
  renderRecordsActionChips();
  renderRecordsTable();
  renderMain();
})();
