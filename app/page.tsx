"use client";

import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, deleteDoc, doc, writeBatch, setDoc, updateDoc } from "firebase/firestore";

// --- 設定エリア ---
const firebaseConfig = {
  apiKey: "AIzaSyDD3RYBSQXwpdwEapRVG4awowYVzsfKzeI",
  authDomain: "soccer-calendar-8fa1b.firebaseapp.com",
  projectId: "soccer-calendar-8fa1b",
  storageBucket: "soccer-calendar-8fa1b.firebasestorage.app",
  messagingSenderId: "749909916331",
  appId: "1:749909916331:web:bf3b7b79e4586be97215ee"
};

const API_KEY = "AIzaSyDfUgp9d4QsdZT-YkxRl1EVNpPnv-6TA50";
const SPREADSHEET_ID = "1E6IUcTVV7tzx1A2aLFoZvVuP8hKTyVoSIGmXFqD-Des";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 六曜計算用簡易関数 (※JavaScript標準の範囲で近似計算を行うためのもの) ---
// 本来は旧暦計算が必要ですが、ここではUIへの組み込みを優先したロジックを想定
const getRokuyo = (date: Date) => {
  const rokuyoList = ["大安", "赤口", "先勝", "友引", "先負", "仏滅"];
  // 簡易計算（厳密な旧暦計算ではないため、実用にはライブラリ併用を推奨）
  // ここでは表示場所の確保を確認するためのダミーとして、日付ベースで回しています
  return rokuyoList[date.getDate() % 6];
};

// --- 共通コンポーネント ---
const Card = ({ children, className = "", onClick }: any) => (
  <div onClick={onClick} className={`bg-white border border-gray-200 rounded-xl shadow-sm text-slate-900 ${className}`}>{children}</div>
);

const Button = ({ children, onClick, className = "", disabled = false }: any) => (
  <button 
    disabled={disabled} 
    onClick={onClick} 
    className={`px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition disabled:bg-slate-300 active:scale-95 ${className}`}
  >
    {children}
  </button>
);

const Input = (props: any) => (
  <input {...props} className="w-full border border-gray-200 rounded-xl p-3 text-slate-900 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
);

const Select = ({ value, onChange, options, className = "" }: any) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`flex-1 min-w-[60px] p-2 rounded-lg border border-slate-300 text-xs bg-white font-medium outline-none ${className}`}>
    {options.map((opt: any) => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
  </select>
);

export default function SoccerCalendarApp() {
  const getJSTDate = () => {
    const now = new Date();
    return new Date(now.getTime() + (9 * 60 * 60 * 1000));
  };

  const jstNow = getJSTDate();
  const [current, setCurrent] = useState(new Date(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1));
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [inputDate, setInputDate] = useState(""); 
  const [startH, setStartH] = useState("16"); 
  const [startM, setStartM] = useState("00"); 
  const [endH, setEndH] = useState("18"); 
  const [endM, setEndM] = useState("00"); 
  const [type, setType] = useState("0");
  const [location, setLocation] = useState("");
  const [opponent, setOpponent] = useState("");
  const [isOff, setIsOff] = useState(false); 
  const [editingGameId, setEditingGameId] = useState<string | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const toHalfWidth = (str: string) => str ? str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : "";

  const getTypeConfig = (typeInput: string) => {
    const val = typeInput || "";
    if (val === "1" || val.includes("練習試合") || val.includes("トレマ")) return { label: "ト", full: "トレマ", color: "bg-green-600", typeId: "1" };
    if (val === "2" || val.includes("リーグ") || val.includes("公式戦") || val.includes("わかとり")) return { label: "リ", full: "リーグ戦", color: "bg-blue-600", typeId: "2" };
    if (val === "0" || val.includes("練習")) return { label: "練", full: "練習", color: "bg-gray-500", typeId: "0" };
    return { label: "他", full: "他試合", color: "bg-orange-500", typeId: "3" };
  };

  const syncWithSpreadsheet = async () => {
    if (API_KEY.includes("貼り付け")) return alert("APIキーを設定してください");
    setIsSyncing(true);
    try {
      const targetYear = current.getFullYear();
      const targetMonth = current.getMonth() + 1;
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title&key=${API_KEY}`);
      const metaData = await metaRes.json();
      const allSheetTitles = metaData.sheets.map((s: any) => s.properties.title);
      const matchedSheetName = allSheetTitles.find((title: string) => {
        const fw = String(targetMonth).replace(/[0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
        return title.match(new RegExp(`(^|[^0-9０-９])(${targetMonth}|${fw})月`)) || title.match(new RegExp(`^(${targetMonth}|${fw})$`));
      });
      if (!matchedSheetName) throw new Error(`「${targetMonth}月」のタブがありません`);
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(matchedSheetName)}!A1:G100?key=${API_KEY}`);
      const data = await res.json();
      const rows = data.values;
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i][0]?.includes("日") && (rows[i][3]?.includes("種別") || rows[i][3]?.includes("練習"))) { headerIdx = i; break; }
      }
      const batch = writeBatch(db);
      const targetYM = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      games.filter(g => g.date?.startsWith(targetYM) && !g.isOff).forEach(d => batch.delete(doc(db, "games", d.id)));
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const dStr = toHalfWidth(row[0] || "");
        if (!dStr || isNaN(parseInt(dStr)) || !row[3] || row[3] === "オフ" || row[3] === "／") continue;
        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${dStr.padStart(2, '0')}`;
        const cfg = getTypeConfig(row[3]);
        batch.set(doc(db, "games", `API_${dateStr}_${i}`), { date: dateStr, time: toHalfWidth(row[5] || "未定"), type: cfg.typeId, location: row[4] || "未定", opponent: row[6] || "", isOff: false });
      }
      await batch.commit();
    } catch (err: any) { alert(err.message); } finally { setIsSyncing(false); }
  };

  const saveGame = async () => {
    if (!inputDate) return alert("日付選択");
    const timeFull = isOff ? "00:00～00:01" : `${startH}:${startM}～${endH}:${endM}`;
    try {
      if (editingGameId) await updateDoc(doc(db, "games", editingGameId), { date: inputDate, time: timeFull, type, location, opponent, isOff });
      else {
        const r = Math.random().toString(36).substring(2, 7);
        await setDoc(doc(db, "games", isOff ? `OFF_${inputDate}_${r}` : `MANUAL_${inputDate}_${r}`), { date: inputDate, time: timeFull, type, location: location || "", opponent, isOff });
      }
      resetForm();
    } catch (e: any) { alert(e.message); }
  };

  const resetForm = () => { setInputDate(""); setLocation(""); setOpponent(""); setIsOff(false); setEditingGameId(null); };

  const startEdit = (g: any) => {
    const [start, end] = (g.time || "00:00～00:00").split("～");
    const [sh, sm] = (start || "00:00").split(":");
    const [eh, em] = (end || "00:00").split(":");
    setEditingGameId(g.id); setInputDate(g.date); setStartH(sh); setStartM(sm); setEndH(eh); setEndM(em);
    setType(g.type || "0"); setLocation(g.location || ""); setOpponent(g.opponent || ""); setIsOff(g.isOff || false);
    setSelectedDate(null);
    document.getElementById("input-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const calendarCells = useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const first = new Date(year, month, 1).getDay();
    const gByD = games.reduce((acc: any, g: any) => {
      if (!g.date) return acc;
      if (!acc[g.date]) acc[g.date] = [];
      acc[g.date].push(g);
      return acc;
    }, {});

    const cells = [];
    for (let i = 0; i < first; i++) cells.push(<div key={`empty-${i}`} />);
    
    const t = getJSTDate();
    const todayStr = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;

    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = (gByD[dateStr] || []);
      const dayGames = dayData.filter((g: any) => !g.isOff).sort((a: any, b: any) => a.time.localeCompare(b.time));
      const hasOff = dayData.some((g: any) => g.isOff);
      const isToday = dateStr === todayStr;
      
      // 六曜を取得
      const rokuyo = getRokuyo(new Date(year, month, d));

      cells.push(
        <Card key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`p-1 min-h-[90px] cursor-pointer relative ${isToday ? 'bg-yellow-100 ring-2 ring-yellow-500' : 'hover:bg-slate-50'}`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className={`text-[10px] font-black leading-none ${isToday ? 'text-yellow-800' : 'text-slate-400'}`}>
                {d}
              </span>
              {/* 六曜表示部分 */}
              <span className={`text-[7px] mt-0.5 font-bold ${rokuyo === "大安" ? "text-red-500" : "text-slate-400"}`}>
                {rokuyo}
              </span>
            </div>
            {hasOff && <div className="w-4 h-4 border-2 border-red-500 rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div></div>}
          </div>
          <div className="mt-1 space-y-0.5">
            {dayGames.map((g: any) => (
              <div key={g.id} className={`${getTypeConfig(g.type).color} text-white text-[7px] p-0.5 rounded truncate`}>
                [{getTypeConfig(g.type).label}]{g.location}
              </div>
            ))}
          </div>
        </Card>
      );
    }
    return cells;
  }, [year, month, games]);

  return (
    <div className="max-w-4xl mx-auto p-2 bg-white min-h-screen text-slate-900 pb-20">
      <h1 className="text-xl font-black text-center py-4">⚽ 部活カレンダー</h1>
      
      <div key={`header-${current.getTime()}`} className="flex flex-col sm:flex-row justify-between items-center mb-4 bg-slate-100 p-3 rounded-xl gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-3 bg-white rounded-lg shadow-sm active:bg-slate-200">←</button>
          <h2 className="text-lg font-black min-w-[120px] text-center">{year}年 {month + 1}月</h2>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-3 bg-white rounded-lg shadow-sm active:bg-slate-200">→</button>
        </div>
        <div className="flex gap-2">
           <Button onClick={syncWithSpreadsheet} disabled={isSyncing} className="bg-green-600 text-xs">
             {isSyncing ? "同期中..." : "🔄 直接同期"}
           </Button>
           <button 
             onClick={() => { const d = getJSTDate(); setCurrent(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1)); }} 
             className="px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-md shadow-md active:bg-slate-900 active:scale-95 transition-all"
           >
             今日へ移動
           </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-bold text-center ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'}`}>{d}</div>
        ))}
        {calendarCells}
      </div>

      <Card id="input-form" className={`p-4 border-none mb-10 ${editingGameId ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-slate-50'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-500 text-xs uppercase">{editingGameId ? "編集" : "新規登録"}</h3>
          <label className="flex items-center gap-2 cursor-pointer">
             <span className="text-[10px] font-bold">親の休み</span>
             <input type="checkbox" checked={isOff} onChange={(e) => setIsOff(e.target.checked)} className="w-5 h-5 accent-red-500" />
          </label>
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={inputDate} onChange={(e:any) => setInputDate(e.target.value)} />
            <select disabled={isOff} className="p-3 rounded-xl border text-sm font-bold bg-white" value={type} onChange={(e)=>setType(e.target.value)}>
              <option value="0">🏃 練習</option><option value="1">🤝 トレマ</option><option value="2">🏆 リーグ戦</option><option value="3">⚽ その他</option>
            </select>
          </div>
          {!isOff && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border">
              <Select value={startH} onChange={setStartH} options={Array.from({length:24},(_,i)=>({val:String(i).padStart(2,'0'), label:`${i}時`}))} />
              <Select value={startM} onChange={setStartM} options={["00","15","30","45"].map(m=>({val:m, label:`${m}分`}))} />
              <span className="text-slate-300">～</span>
              <Select value={endH} onChange={setEndH} options={Array.from({length:24},(_,i)=>({val:String(i).padStart(2,'0'), label:`${i}時`}))} />
              <Select value={endM} onChange={setEndM} options={["00","15","30","45"].map(m=>({val:m, label:`${m}分`}))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input disabled={isOff} placeholder="場所" value={location} onChange={(e:any) => setLocation(e.target.value)} />
            <Input disabled={isOff} placeholder="対戦相手" value={opponent} onChange={(e:any) => setOpponent(e.target.value)} />
          </div>
          <Button onClick={saveGame} className={`py-4 ${isOff ? 'bg-red-500 hover:bg-red-600' : ''}`}>
            {editingGameId ? "保存" : isOff ? "休み登録" : "予定登録"}
          </Button>
          {editingGameId && <button onClick={resetForm} className="text-xs text-slate-400 mt-2 text-center underline">キャンセル</button>}
        </div>
      </Card>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-4 border-b pb-2">{selectedDate}</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {(games.filter(g => g.date === selectedDate)).sort((a:any,b:any)=> (a.isOff?1:0) - (b.isOff?1:0)).map((g: any) => (
                <div key={g.id} className={`p-4 rounded-xl border ${g.isOff ? 'bg-red-50 border-red-100' : 'bg-white shadow-sm'}`}>
                  {g.isOff ? (
                    <div className="flex justify-between items-center text-red-600 font-bold">
                      <span>🛑 親の休み</span>
                      <button onClick={async () => { if(confirm("消去？")) { await deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); } }} className="text-xs underline p-2">削除</button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-blue-600 font-black">🕒 {g.time}</div>
                      <div className="font-bold">📍 {g.location}</div>
                      {g.opponent && <div className="text-xs text-slate-500 mt-1">🆚 {g.opponent}</div>}
                      <div className="mt-3 flex gap-4 text-[10px] font-bold pt-2 border-t">
                        <button onClick={() => startEdit(g)} className="text-blue-500 p-2">編集</button>
                        <button onClick={async () => { if(confirm("削除？")) { await deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); } }} className="text-red-400 p-2">削除</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedDate(null)} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-bold">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}