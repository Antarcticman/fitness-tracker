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
let SESSION_START_TIME = null; 
let importedRows = []; 
let myChart = null;
let chartUnit = "kg"; 
let displayUnit = "kg"; 

// ====== UI 輔助函式 (Toast & Modal) ======
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function showConfirm(title, body, onConfirm) {
  const m = document.getElementById("customModal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").textContent = body;
  m.classList.remove("hidden");
  
  const btnC = document.getElementById("modalBtnCancel");
  const btnO = document.getElementById("modalBtnConfirm");
  
  btnC.onclick = () => m.classList.add("hidden");
  btnO.onclick = () => { m.classList.add("hidden"); onConfirm(); };
}

// ====== 真理時間軸 (絕對時間掃描) ======
function getLatestEndTime() {
  let latest = null;
  blocks.forEach(b => {
    b.sets.forEach(s => {
      if (s.endTime && (!latest || s.endTime > latest)) latest = s.endTime;
    });
  });
  return latest || SESSION_START_TIME; 
}

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
// ====== 全域計時器 & 狀態監控 ======
setInterval(() => {
  const activeB = blocks.find(b => b.isWorking && !b.ended);
  
  // 1. 更新工作計時器
  if (activeB && activeB.currentSetStart) {
    const el = document.getElementById(`header-timer-${activeB.id}`);
    if (el) el.textContent = `⏱️ ${fmtDuration(Date.now() - activeB.currentSetStart)}`;
  }

  // 2. 清理背景狀態與所有震動
  document.body.classList.remove("working-mode", "rest-warning", "rest-danger");
  
  if (activeB) {
    document.body.classList.add("working-mode");
    document.querySelectorAll(".zookeeper-shake").forEach(el => el.classList.remove("zookeeper-shake"));
  } else {
    let maxRestDiff = 0;
    let blockToShake = null;

    // 3. 更新休息計時器並找出最久的休息時間
    blocks.forEach(b => {
      if (!b.ended && !b.isWorking) {
          // 休息計時
          let refTime = b.lastSetEnd || (b.sets.length===0 ? getLatestEndTime() : null);
          if (refTime) {
              const diff = Date.now() - refTime;
              if (diff > maxRestDiff) { maxRestDiff = diff; blockToShake = b.id; }
              const el = document.getElementById(`header-timer-${b.id}`);
              if (el) {
                  el.textContent = `☕ ${fmtDuration(diff)}`;
                  el.className = "header-timer resting"; 
              }
          }
      }
    });

    // 4. 套用背景漸變與 Zookeeper 震動
    const shakeTarget = document.getElementById(`block-${blockToShake}`);
    document.querySelectorAll(".zookeeper-shake").forEach(el => {
       if(!shakeTarget || el !== shakeTarget) el.classList.remove("zookeeper-shake");
    });

    if (maxRestDiff > 180000) { // 超過 3 分鐘 (紅色 + 震動)
      document.body.classList.add("rest-danger");
      if(shakeTarget && !shakeTarget.classList.contains("disabled")) shakeTarget.classList.add("zookeeper-shake");
    } else if (maxRestDiff > 120000) { // 超過 2 分鐘 (黃色)
      document.body.classList.add("rest-warning");
    }
  }
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

// ====== API (Firebase Firestore 版) ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// 你的 Firebase 設定檔
const firebaseConfig = {
  apiKey: "AIzaSyAiXGMdhpmp_CDqTTGkS869eZeR5-FPt20",
  authDomain: "nescient-fitness.firebaseapp.com",
  projectId: "nescient-fitness",
  storageBucket: "nescient-fitness.firebasestorage.app",
  messagingSenderId: "1025865199598",
  appId: "1:1025865199598:web:132e0343749264b8de28ff",
  measurementId: "G-526FZJ49JL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 讀取資料
async function apiLoadRows(){
  // 1. 讀取動作庫 (Catalog)
  try {
    const catSnap = await getDoc(doc(db, "config", "catalog"));
    if(catSnap.exists()) CATALOG = catSnap.data();
  } catch(e) { console.log("Catalog尚未建立", e); }

  // 2. 讀取歷史紀錄
  const querySnapshot = await getDocs(collection(db, "records"));
  const rows = [];
  querySnapshot.forEach((document) => {
    rows.push(document.data());
  });

  return rows.map(row => {
    const d = new Date(row["日期"]);
    const logicalDate = new Date(d);
    if (logicalDate.getHours() < 7) logicalDate.setDate(logicalDate.getDate() - 1);
    row._dateStr = ymd(logicalDate);
    return row;
  });
}

// 寫入新紀錄
async function apiAppendRows(rows){
  let count = 0;
  for(let r of rows) {
    await addDoc(collection(db, "records"), r);
    count++;
  }
  return count;
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
  wrap.id = "block-" + b.id;
  
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
      showConfirm("刪除動作", "確定要刪除這個動作紀錄嗎？", () => {
        const idx = blocks.indexOf(b);
        if(idx > -1) blocks.splice(idx, 1);
        if(blocks.length === 0) SESSION_START_TIME = null;
        renderMain(); renderActionNav();
      });
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

  // 核心邏輯區
  const updateSummary = ()=>{
    if(b.isWorking) timerDiv.className = "header-timer working";
    else timerDiv.className = "header-timer resting";

    if (b.ended){ 
      sText.textContent = "✓ 此動作已完成"; 
      sText.style.color = "var(--text-muted)";
      timerDiv.textContent = ""; 
      return; 
    }

    // 狀態判斷：編輯舊資料 vs 準備新資料
    if (b.activeSetIdx !== null && !b.isWorking) {
        // === 編輯模式 ===
        const src = b.sets[b.activeSetIdx];
        const kg = Number(src.weight)||0;
        const lb = kgToNearestLbStep(kg);
        // ★ 修正文字：顯示「編輯第 N 組」
        sText.textContent = `編輯第 ${b.activeSetIdx + 1} 組：${lb} lb (${kg} kg) · ${src.reps} 下`;
        sText.style.color = "var(--accent-rest)"; // 用黃色區分編輯狀態
        
        // 編輯時隱藏開始按鈕 (避免誤觸) 或 顯示「完成編輯」
        actionBtn.textContent = "完成編輯";
        actionBtn.className = "btn btn-primary"; // 變回紫色
    } else {
        // === 準備/進行模式 ===
        const idx = b.sets.length + 1;
        if (b.isWorking) {
            sText.textContent = `🔥 第 ${idx} 組進行中...`;
            sText.style.color = "#4ade80"; 
            actionBtn.textContent = "完成這一組";
            actionBtn.className = "btn btn-danger"; 
        } else {
            const src = b.temp; // 讀取暫存區
            const kg = Number(src.weight)||0;
            const lb = kgToNearestLbStep(kg);
            
            // 休息計時
            let refTime = b.lastSetEnd || (b.sets.length===0 ? getLatestEndTime() : null);
            if(refTime) {
                 const diff = Date.now() - refTime;
                 timerDiv.textContent = `☕ ${fmtDuration(diff)}`;
            } else {
                 timerDiv.textContent = ""; 
            }

            // ★ 修正文字：顯示「準備」
            sText.textContent = (idx > MAX_SETS) ? "已完成四組訓練" : `準備：${lb} lb (${kg} kg) · ${src.reps} 下`;
            sText.style.color = "var(--accent)";
            actionBtn.textContent = (idx > MAX_SETS) ? "已完成四組" : "開始這一組";
            actionBtn.className = "btn btn-start"; 
        }
    }
  };

  function rebuildWheels(){                          
    const editingExisting = b.activeSetIdx !== null;
    const src = editingExisting ? b.sets[b.activeSetIdx] : b.temp;
    const lbValues = []; for (let lb=0; lb<=LB_MAX; lb+=LB_STEP) lbValues.push(lb);
    const initLb = kgToNearestLbStep(Number(src.weight)||0);
    
    // 轉盤重建時，避免重複綁定，buildWheel 會清空 innerHTML
    buildWheel(wheelW, lbValues, initLb, (valLb)=>{
      const valKg = Math.round(lbToKg(valLb)*10)/10;
      
      if (b.activeSetIdx === null) {
          // 準備模式：只改 temp
          b.temp.weight = valKg;
      } else {
          // ★ 編輯模式：直接改 sets 資料，並強制刷新列表 (即時聯動)
          b.sets[b.activeSetIdx].weight = valKg;
          renderSetListInner(listWrap, b); // 讓右邊列表數字跟著跳
      }
      updateSummary(); // 讓標題文字跟著跳
    });

    buildWheel(wheelR, rangeArray(1,20,1), Number(src.reps)||10, (val)=>{
      if (b.activeSetIdx === null) {
          b.temp.reps = val;
      } else {
          // ★ 編輯模式：即時聯動
          b.sets[b.activeSetIdx].reps = val;
          renderSetListInner(listWrap, b);
      }
      updateSummary();
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
    
    // 按鈕狀態控制
    if (b.activeSetIdx !== null) {
        // 編輯中
        actionBtn.style.display = "inline-flex";
        actionBtn.disabled = false;
        endBtn.disabled = true; // 編輯舊資料時不能結束動作
        endBtn.style.opacity = "0.5";
    } else if (b.isWorking) {
        // 進行中
        actionBtn.style.display = "inline-flex"; actionBtn.disabled = false;
        endBtn.disabled = true; endBtn.style.opacity = "0.5"; endBtn.textContent = "訓練進行中...";
    } else {
        // 準備中
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
      
      // ★ 點擊邏輯優化：切換選取狀態
      infoDiv.addEventListener("click", ()=>{
        if(bRef.isWorking) return; // 運動中不能改舊資料
        
        if (bRef.activeSetIdx === idx) {
            // 再次點擊 -> 取消選取 (回到準備狀態)
            bRef.activeSetIdx = null;
        } else {
            // 選取該組
            bRef.activeSetIdx = idx;
        }
        rebuildWheels(); 
        updateSummary(); 
        renderSetListInner(container, bRef); 
        refreshButtons();
      });

      const delBtn = el("button", "del-btn", "✕");
      delBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        // ★ alert 換成 showToast
        if(bRef.isWorking) { showToast("請先完成目前這一組"); return; }
        
        // ★ confirm 換成 showConfirm
        showConfirm("刪除組數", `確定刪除第 ${idx+1} 組嗎？`, () => {
          bRef.sets.splice(idx, 1); bRef.activeSetIdx = null;
          // 刪除後把最新一組的數據帶入 temp，方便繼續做
          if(bRef.sets.length > 0) bRef.temp = { ...bRef.sets[bRef.sets.length-1] };
          rebuildWheels(); updateSummary(); renderSetListInner(container, bRef); refreshButtons();
        });
      });
      li.append(infoDiv, delBtn);
      container.append(li);
    });
    
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

  // 按鈕事件：支援「完成編輯」邏輯
  actionBtn.addEventListener("click", ()=>{
    if (b.ended) return;
    
    // 如果正在編輯舊資料 -> 點按鈕等於「完成編輯」(回到準備狀態)
    if (b.activeSetIdx !== null) {
        b.activeSetIdx = null;
        rebuildWheels(); 
        updateSummary(); 
        renderSetListInner(listWrap, b); 
        refreshButtons();
        return;
    }

    const now = Date.now();
    if(!SESSION_START_TIME) SESSION_START_TIME = now;

    if (!b.isWorking) {
        // === START ===
        b.isWorking = true; b.currentSetStart = now; 
        
        let lastEnd = getLatestEndTime(); 
        let rest = 0; if(lastEnd) rest = now - lastEnd; 
        b.tempRestTime = rest;

        timerDiv.textContent = `⏱️ 0:00`;
        timerDiv.className = "header-timer working";

        wrap.classList.add("active-block");
        updateSummary(); refreshButtons(); renderSetListInner(listWrap, b);
    } else {
        // === FINISH ===
        b.isWorking = false;
        let work = 0; if(b.currentSetStart) work = now - b.currentSetStart;
        
        timerDiv.textContent = `☕ 0:00`;
        timerDiv.className = "header-timer resting";

        // 寫入新紀錄 (加入 endTime)
        const src = b.temp; 
        b.sets.push({ reps: src.reps, weight: src.weight, restTime: b.tempRestTime, workTime: work, endTime: now });
        
        // 繼承給下一組
        b.temp = { reps: src.reps, weight: src.weight }; 
        
        b.lastSetEnd = now;
        wrap.classList.remove("active-block");
        rebuildWheels(); updateSummary(); renderSetListInner(listWrap, b); refreshButtons();
    }
  });

  endBtn.addEventListener("click", ()=>{
    if (b.ended) return;
    // ★ 換成深色 Modal
    showConfirm("結束動作", "確定結束此動作？", () => {
        b.ended = true; wrap.classList.add("disabled");
        updateSummary(); refreshButtons();
        currentActionIdx = null; renderActionNav(); renderMain();
    });
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
      if (activeB && !activeB.ended) { 
        // ★ 換成 Toast 提示與錯誤晃動
        showToast("請先完成目前的動作，才能切換部位！"); 
        const activeEl = document.getElementById(`block-${activeB.id}`);
        if(activeEl) {
          activeEl.scrollIntoView({behavior: "smooth", block: "start"});
          activeEl.classList.remove("error-shake");
          void activeEl.offsetWidth; // 強制重繪
          activeEl.classList.add("error-shake");
        }
        return; 
      }
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
      // 在 renderActionNav 的 chip click 裡：
      if (currentActive && !currentActive.ended) {
        if (currentActive.part === currentPart && currentActive.actionIdx === i) return;
        
        showToast("請先完成目前的動作！"); 
        const activeEl = document.getElementById(`block-${currentActive.id}`);
        if(activeEl) {
          activeEl.scrollIntoView({behavior: "smooth", block: "start"});
          // 觸發 Error Shake 動畫
          activeEl.classList.remove("error-shake");
          void activeEl.offsetWidth; // 強制重繪
          activeEl.classList.add("error-shake");
        }
        return;
      }
      
      currentActionIdx = i;
      const newBlock = createBlock(currentPart, i); // 建立新區塊
      
      // 繼承上一次重量
      const nb = getActiveBlock();
      const partZh = CATALOG[nb.part].label;
      const nm   = CATALOG[nb.part].exercises[nb.actionIdx];
      const last = getLastDefaultsFromCsv(partZh, nm);
      nb.temp = { reps:last.reps, weight:last.weight };
      
      renderActionNav(); 
      renderMain();
      
      // ★ 修正：建立新動作後，直接捲動到頁面最底部
      setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
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

// 獨立出來的清空邏輯 (不帶確認視窗，供同步成功後直接呼叫)
function clearBoardData(){
  blocks.length = 0; idCounter = 1; currentPart = null; currentActionIdx = null; SESSION_START_TIME = null;
  renderBottomNav(); renderActionNav(); renderMain();
}

function resetMainFromCsv(){
  // 改用自訂的深色確認視窗
  showConfirm("清除全部", "確定要清除所有目前的訓練卡片嗎？", () => {
    clearBoardData();
  });
}

finishDayBtn?.addEventListener("click", ()=>{
  const rows = collectTodayRows();
  if (!rows.length){ showToast("尚未有任何組數紀錄。"); return; }
  document.getElementById("exportTitle").textContent = "本次運動總結";
  renderExportPreview(rows);
  exportPanel.classList.remove("hidden");
});

closeExportBtn?.addEventListener("click", ()=> exportPanel.classList.add("hidden"));

confirmAppendBtn?.addEventListener("click", async ()=>{
  confirmAppendBtn.disabled = true; confirmAppendBtn.textContent = "同步中...";
  try{
    const rows = collectTodayRows();
    if (!rows.length){ showToast("尚未有任何組數紀錄。"); confirmAppendBtn.disabled=false; return; }
    const appended = await apiAppendRows(rows); 
    await reloadFromBackend(); 
    exportPanel.classList.add("hidden"); 
    clearBoardData(); // 同步成功後安靜清空，不彈 confirm
    
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="records"]')?.classList.add("active");
    Object.values(pages).forEach(p => p.classList.remove("show"));
    pages.records.classList.add("show");
    renderRecordsTable(); 
    showToast(`🎉 同步成功！已儲存 ${appended} 筆紀錄。`);
  }catch(e){ console.error(e); showToast("同步發生異常：" + e.message); } 
  finally { confirmAppendBtn.disabled = false; confirmAppendBtn.textContent = "確認提交"; }
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
    
    // 1. 日期簡化 (只取 MM/DD)
    const dateRaw = r["日期"] || ""; 
    let cleanDate = r._dateStr || dateRaw.split("T")[0];
    if(cleanDate.length >= 5) cleanDate = cleanDate.substring(5); 
    
    [cleanDate, r["部位"], r["動作"]].forEach(txt => { 
        const td = document.createElement("td"); 
        td.textContent = txt; 
        tr.appendChild(td); 
    });

    // 2. 建立組數欄位
    for(let i=1; i<=4; i++){
       const td = document.createElement("td");
       const reps = Number(r[`組${i}`]) || 0; 
       const weight = Number(r[`重${i}`]) || 0; 
       const sec = Number(r[`秒${i}`]) || 0; 
       
       if(reps > 0 || weight > 0){
           let wDisplay = "";
           // ★ 單位加回來了
           if(displayUnit === "lb"){ 
               const lb = kgToNearestLbStep(weight); 
               wDisplay = `${lb} lb`; 
           } else { 
               wDisplay = `${weight} kg`; 
           }
           
           // 秒數顯示 (如果有)
           let timeHtml = sec > 0 ? `<div class="set-time">⏱️ ${sec}s</div>` : "";

           // 結構：組數跟重量用 div 包起來，方便 CSS 控制
           td.innerHTML = `
             <div class="set-main">${reps} 下</div>
             <div class="set-main">${wDisplay}</div>
             ${timeHtml}
           `;
       } else { 
           td.textContent = "-"; 
           td.style.color = "#444"; 
       }
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
// 修改後的日曆詳情函式 (包含時間計算)
function renderCalendarDetails(){
  calSideList.innerHTML = "";
  if (!selectedCalDate){ calSideTitle.textContent = "選擇日期查看詳情"; return; }
  
  // 篩選出當天的資料
  const rows = (importedRows || []).filter(r => (r._dateStr || r["日期"]) === selectedCalDate);
  
  // ★ 計算當日總秒數 (累加所有 秒n 與 休n)
  let totalSec = 0;
  rows.forEach(r => {
      for(let i=1; i<=4; i++){
          totalSec += (Number(r[`秒${i}`]) || 0);
          totalSec += (Number(r[`休${i}`]) || 0);
      }
  });

  // 標題顯示日期 + 總時間
  let timeStr = "";
  if(totalSec > 0) {
      const h = Math.floor(totalSec/3600);
      const m = Math.floor((totalSec%3600)/60);
      timeStr = ` (${h}小時${m}分)`;
  }
  calSideTitle.textContent = `${selectedCalDate}${timeStr}`;

  if (rows.length === 0){ calSideList.append(el("li","side-item","這一天沒有紀錄")); return; }
  
  rows.forEach(r=>{
    const li = el("li","side-item");
    const top = el("div","si-top"); 
    top.append(el("span","", `${r["部位"]} · ${r["動作"]}`)); 
    li.append(top);
    
    const detail = el("div","si-sub");
    for (let i=1;i<=4;i++){
      const reps = Number(r[`組${i}`]) || 0; 
      const wkg  = Number(r[`重${i}`]) || 0;
      if (reps || wkg){ 
          const lb = kgToNearestLbStep(wkg); 
          detail.append(el("div","si-line", `${reps} 下 @ ${lb} lb (${wkg} kg)`)); 
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
  if(!editorContainer) return; editorContainer.innerHTML = "";
  Object.entries(CATALOG).forEach(([key, val]) => {
    const box = el("div", "edit-group");
    const head = el("div", "eg-head"); head.innerHTML = `<strong>${val.label}</strong> <span style="font-size:0.8em;opacity:0.6">(${key})</span>`;
    
    const delPartBtn = el("button", "btn btn-danger btn-sm", "刪除部位");
    // ★ 把 confirm 換成 showConfirm
    delPartBtn.onclick = () => { 
      showConfirm("刪除部位", `確定刪除「${val.label}」及其所有動作？`, () => {
        delete CATALOG[key]; 
        renderEditor();
      });
    };
    
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
    if(k && l){ 
      // ★ 把 alert 換成 showToast
      if(CATALOG[k]) { showToast("ID 已存在"); return; } 
      CATALOG[k] = { label: l, exercises: [] }; 
      renderEditor(); 
    } else { 
      showToast("請輸入完整"); 
    }
  };
  
  npRow.append(keyInput, labelInput, npBtn); newPartBox.appendChild(npRow); editorContainer.appendChild(newPartBox);
}

saveCatalogBtn?.addEventListener("click", async () => {
  saveCatalogBtn.disabled = true; saveCatalogBtn.textContent = "儲存中...";
  try {
    // 寫入 Firestore 的 config/catalog
    await setDoc(doc(db, "config", "catalog"), CATALOG);
    // ★ 把 alert 換成 showToast
    showToast("設定已儲存！"); 
    renderBottomNav(); renderActionNav(); 
  } catch(e) { 
    showToast("儲存失敗：" + e.message); 
    console.error(e); 
  }
  saveCatalogBtn.disabled = false; saveCatalogBtn.textContent = "儲存變更到雲端";
});

// ====== Tabs Switching ======
tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active")); 
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    
    Object.values(pages).forEach(p=>p?.classList.remove("show"));
    if(pages[tab]) pages[tab].classList.add("show");
    
    // ★ 切回主頁時的捲動邏輯
    if(tab === "main") {
        setTimeout(() => {
            // 優先找正在進行的卡片
            const activeEl = document.querySelector(".active-block");
            if(activeEl) {
                activeEl.scrollIntoView({behavior: "smooth", block: "start"});
            } else {
                // 如果都沒有，就捲到最下面 (通常是最新建立的動作)
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        }, 100);
    }

    if(tab === "settings") { document.getElementById("page-settings")?.classList.add("show"); renderEditor(); }
    if (tab === "calendar") { renderCalendarWeekdays(); renderCalendar(); }
    if (tab === "records")  { renderRecordsTable(); }
  });
});

// ====== Auth Logic & Init ======
const loginModal = document.getElementById("loginModal");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

loginBtn?.addEventListener("click", async () => {
  const e = loginEmail.value.trim();
  const p = loginPassword.value.trim();
  if(!e || !p) { showToast("請輸入信箱與密碼"); return; }
  loginBtn.disabled = true; loginBtn.textContent = "登入中...";
  try {
    await signInWithEmailAndPassword(auth, e, p);
  } catch(err) {
    showToast("登入失敗：" + err.message);
    loginBtn.disabled = false; loginBtn.textContent = "登入";
  }
});

logoutBtn?.addEventListener("click", () => {
  showConfirm("登出", "確定要登出系統嗎？", () => {
    signOut(auth).then(() => {
      importedRows = [];
      clearBoardData();
    });
  });
});

let isAppInitialized = false;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginModal.classList.add("hidden");
    if(!isAppInitialized) {
      isAppInitialized = true;
      try { await reloadFromBackend(); } catch(e){ console.warn("後端連線中...", e); }
      renderCalendarWeekdays();
      blocks.length = 0; idCounter = 1; currentPart = null; currentActionIdx = null; SESSION_START_TIME = null;
      if(importedRows.length > 0) renderRecordsFilters(importedRows); 
      renderRecordsTable();
      renderBottomNav(); renderActionNav(); renderMain();
    }
  } else {
    loginModal.classList.remove("hidden");
    isAppInitialized = false;
    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = "登入"; }
  }
});