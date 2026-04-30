"use client";

import { useState, useEffect } from "react";
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

// ★ここに取得したAPIキーを入力してください
const API_KEY = "AIzaSyDfUgp9d4QsdZT-YkxRl1EVNpPnv-6TA50";
const SPREADSHEET_ID = "1E6IUcTVV7tzx1A2aLFoZvVuP8hKTyVoSIGmXFqD-Des";
const SHEET_NAME = "シート1"; 

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

  const todayStr = (() => {
    const d = getJSTDate();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  })();

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

  // --- スプレッドシート同期（API版） ---
  const syncWithSpreadsheet = async () => {
    if (API_KEY.includes("貼り付け")) return alert("APIキーを設定してください");
    
    setIsSyncing(true);
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:G100?key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.values) throw new Error("データの取得に失敗しました。共有設定を確認してください。");
      const rows = data.values;

      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        if (rows[i][0]?.includes("日") && rows[i][3]?.includes("練習")) { headerIdx = i; break; }
      }
      if (headerIdx === -1) throw new Error("シートの形式が読み取れません。");

      const firstCell = toHalfWidth(rows[0][0] || "");
      const monthMatch = firstCell.match(/(\d+)月/);
      const targetMonth = monthMatch ? parseInt(monthMatch[1]) : (current.getMonth() + 1);
      const targetYear = firstCell.includes("2027") ? 2027 : 2026;
      const targetYearMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

      if (!confirm(`${targetMonth}月の予定を同期しますか？\n（既存の予定は上書きされますが、「親の休み」は保持されます）`)) return;

      const batch = writeBatch(db);
      const existingDocs = games.filter(g => g.date?.startsWith(targetYearMonth) && !g.isOff);
      existingDocs.forEach(d => batch.delete(doc(db, "games", d.id)));

      let count = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const dStr = toHalfWidth(row[0] || "");
        if (!dStr || isNaN(parseInt(dStr))) continue;

        const pType = row[3];
        if (!pType || pType === "オフ" || pType === "／") continue;

        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${dStr.padStart(2, '0')}`;
        const timeFull = toHalfWidth(row[5] || "未定");
        const cfg = getTypeConfig(pType);
        const customId = `API_${dateStr}_${count}`;
        
        batch.set(doc(db, "games", customId), {
          date: dateStr,
          time: timeFull,
          type: cfg.typeId,
          location: row[4] || "未定",
          opponent: row[6] || "",
          isOff: false,
          memo: "API同期"
        });
        count++;
      }

      await batch.commit();
      setCurrent(new Date(targetYear, targetMonth - 1, 1));
      alert(`${count} 件の予定を同期しました。`);
    } catch (err: any) {
      alert("同期エラー: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveGame = async () => {
    if (!inputDate) return alert("日付を選択してください");
    const timeFull = isOff ? "00:00～00:01" : `${startH}:${startM}～${endH}:${endM}`;
    try {
      if (editingGameId) {
        await updateDoc(doc(db, "games", editingGameId), { date: inputDate, time: timeFull, type, location, opponent, isOff });
      } else {
        const randomStr = Math.random().toString(36).substring(2, 7);
        const customId = isOff ? `OFF_${inputDate}_${randomStr}` : `MANUAL_${inputDate}_${randomStr}`;
        await setDoc(doc(db, "games", customId), { date: inputDate, time: timeFull, type, location: location || "", opponent, isOff });
      }
      resetForm();
    } catch (e: any) { alert(e.message); }
  };

  const resetForm = () => {
    setInputDate(""); setLocation(""); setOpponent(""); setIsOff(false); setEditingGameId(null);
  };

  const startEdit = (g: any) => {
    const [start, end] = (g.time || "00:00～00:00").split("～");
    const [sh, sm] = (start || "00:00").split(":");
    const [eh, em] = (end || "00:00").split(":");
    setEditingGameId(g.id); setInputDate(g.date); setStartH(sh); setStartM(sm); setEndH(eh); setEndM(em);
    setType(g.type || "0"); setLocation(g.location || ""); setOpponent(g.opponent || ""); setIsOff(g.isOff || false);
    setSelectedDate(null);
    document.getElementById("input-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const gamesByDate = games.reduce((acc: any, g: any) => {
    if (!g.date) return acc;
    if (!acc[g.date]) acc[g.date] = [];
    acc[g.date].push(g);
    return acc;
  }, {});

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = (gamesByDate[dateStr] || []);
    const dayGames = dayData.filter((g: any) => !g.isOff).sort((a: any, b: any) => a.time.localeCompare(b.time));
    const isToday = dateStr === todayStr;
    const hasOff = dayData.some((g: any) => g.isOff); 

    cells.push(
      <Card key={d} onClick={() => setSelectedDate(dateStr)} className={`p-1 min-h-[90px] cursor-pointer hover:bg-slate-50 relative ${isToday ? 'bg-yellow-50 ring-2 ring-yellow-400' : ''}`}>
        <div className="flex justify-between items-start">
          <span className={`text-[10px] font-bold ${isToday ? 'text-yellow-700' : 'text-slate-400'}`}>{d}</span>
          {hasOff && <div className="w-4 h-4 border-2 border-red-500 rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div></div>}
        </div>
        <div className="mt-1 space-y-0.5">
          {dayGames.map((g: any) => {
            const cfg = getTypeConfig(g.type);
            return <div key={g.id} className={`${cfg.color} text-white text-[7px] p-0.5 rounded truncate`}>[{cfg.label}]{g.location}</div>;
          })}
        </div>
      </Card>
    );
  }

  const hOpts = Array.from({length:24},(_,i)=>({val:String(i).padStart(2,'0'), label:`${i}時`}));
  const mOpts = ["00","15","30","45"].map(m=>({val:m, label:`${m}分`}));

  return (
    <div className="max-w-4xl mx-auto p-2 bg-white min-h-screen text-slate-900 pb-20">
      <h1 className="text-xl font-black text-center py-4">⚽ 部活カレンダー</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 bg-slate-100 p-3 rounded-xl gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-2 bg-white rounded-lg shadow-sm">←</button>
          <h2 className="text-lg font-black">{year}年 {month + 1}月</h2>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-2 bg-white rounded-lg shadow-sm">→</button>
        </div>
        <div className="flex gap-2">
           <button onClick={syncWithSpreadsheet} disabled={isSyncing} className={`text-xs font-bold px-4 py-2 rounded-lg shadow-md transition ${isSyncing ? 'bg-slate-300' : 'bg-green-600 text-white hover:bg-green-700'}`}>
             {isSyncing ? "同期中..." : "🔄 直接同期"}
           </button>
           <button onClick={() => { const d = getJSTDate(); setCurrent(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1)); }} className="text-xs font-bold bg-white px-4 py-2 rounded-lg border">今日</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-bold text-center ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'}`}>{d}</div>
        ))}
        {cells}
      </div>

      <Card id="input-form" className={`p-4 border-none mb-10 ${editingGameId ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-slate-50'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-500 text-xs uppercase">{editingGameId ? "編集" : "新規登録"}</h3>
          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-full border shadow-sm">
             <span className="text-[10px] font-bold text-slate-500">親の休み</span>
             <input type="checkbox" checked={isOff} onChange={(e) => setIsOff(e.target.checked)} className="w-4 h-4 accent-red-500" />
          </label>
        </div>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={inputDate} onChange={(e:any) => setInputDate(e.target.value)} />
            <select disabled={isOff} className="p-3 rounded-xl border text-sm font-bold bg-white disabled:bg-slate-100" value={type} onChange={(e)=>setType(e.target.value)}>
              <option value="0">🏃 練習</option><option value="1">🤝 トレマ</option><option value="2">🏆 リーグ戦</option><option value="3">⚽ その他</option>
            </select>
          </div>
          {!isOff && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border">
              <Select value={startH} onChange={setStartH} options={hOpts} /><Select value={startM} onChange={setStartM} options={mOpts} />
              <span className="text-slate-300">～</span>
              <Select value={endH} onChange={setEndH} options={hOpts} /><Select value={endM} onChange={setEndM} options={mOpts} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input disabled={isOff} placeholder="場所" value={location} onChange={(e:any) => setLocation(e.target.value)} />
            <Input disabled={isOff} placeholder="対戦相手" value={opponent} onChange={(e:any) => setOpponent(e.target.value)} />
          </div>
          <Button onClick={saveGame} className={`py-4 rounded-xl shadow-lg ${isOff ? 'bg-red-500' : editingGameId ? 'bg-green-600' : ''}`}>
            {editingGameId ? "保存する" : isOff ? "休みを登録" : "予定を登録"}
          </Button>
          {editingGameId && <button onClick={resetForm} className="text-xs text-slate-400">キャンセル</button>}
        </div>
      </Card>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-4 border-b pb-2">{selectedDate}</h3>
            <div className="space-y-3">
              {(gamesByDate[selectedDate] || []).sort((a:any,b:any)=> (a.isOff?1:0) - (b.isOff?1:0)).map((g: any) => (
                <div key={g.id} className={`p-4 rounded-xl border ${g.isOff ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
                  {g.isOff ? (
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-red-600">🛑 親の休み</span>
                      <button onClick={async () => { if(confirm("消去しますか？")) { await deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); } }} className="text-xs text-red-300 underline">削除</button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-blue-600 font-black text-lg">🕒 {g.time}</div>
                      <div className="font-bold text-slate-800">📍 {g.location}</div>
                      {g.opponent && <div className="mt-1 text-sm bg-slate-100 p-1 rounded italic">{g.opponent}</div>}
                      <div className="mt-2 flex gap-4 text-[10px] font-bold border-t pt-2">
                        <button onClick={() => startEdit(g)} className="text-blue-500">編集</button>
                        <button onClick={async () => { if(confirm("削除しますか？")) { await deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); } }} className="text-red-400">削除</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedDate(null)} className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-bold">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}