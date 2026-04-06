"use client";

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, deleteDoc, doc, writeBatch, setDoc, updateDoc } from "firebase/firestore";

// --- Firebase設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyDD3RYBSQXwpdwEapRVG4awowYVzsfKzeI",
  authDomain: "soccer-calendar-8fa1b.firebaseapp.com",
  projectId: "soccer-calendar-8fa1b",
  storageBucket: "soccer-calendar-8fa1b.firebasestorage.app",
  messagingSenderId: "749909916331",
  appId: "1:749909916331:web:bf3b7b79e4586be97215ee"
};

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
  <input {...props} className="w-full border border-gray-300 rounded-xl p-3 text-slate-900 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
);

const Select = ({ value, onChange, options, className = "" }: any) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`flex-1 min-w-[60px] p-2 rounded-lg border border-slate-300 text-xs bg-white font-medium outline-none ${className}`}>
    {options.map((opt: any) => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
  </select>
);

export default function SoccerCalendarApp() {
  // 日本時間(JST)を基準にした初期化
  const getJSTDate = () => {
    const now = new Date();
    return new Date(now.getTime() + (9 * 60 * 60 * 1000));
  };

  const jstNow = getJSTDate();
  const [current, setCurrent] = useState(new Date(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1));
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  // 日本時間の「今日」を YYYY-MM-DD 形式で取得
  const getTodayStr = () => {
    const d = getJSTDate();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const date = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${date}`;
  };

  const todayStr = getTodayStr();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getTypeConfig = (typeInput: string) => {
    const val = typeInput || "";
    if (val === "1" || val.includes("練習試合") || val.includes("トレマ")) return { label: "ト", full: "トレマ", color: "bg-green-600", typeId: "1" };
    if (val === "2" || val.includes("リーグ") || val.includes("公式戦") || val.includes("わかとり")) return { label: "リ", full: "リーグ戦", color: "bg-blue-600", typeId: "2" };
    if (val === "0" || val.includes("練習")) return { label: "練", full: "練習", color: "bg-gray-500", typeId: "0" };
    return { label: "他", full: "他試合", color: "bg-orange-500", typeId: "3" };
  };

  const toHalfWidth = (str: string) => str ? str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : "";

  const clearAllData = async () => {
    if (games.length === 0) return alert("削除するデータがありません");
    if (confirm(`全 ${games.length} 件を削除しますか？`)) {
      const batch = writeBatch(db);
      games.forEach((game) => batch.delete(doc(db, "games", game.id)));
      await batch.commit();
    }
  };

  const deleteMonthData = async () => {
    const targetYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthGames = games.filter(g => g.date && g.date.startsWith(targetYearMonth));
    if (monthGames.length === 0) return alert("この月のデータはありません");
    if (confirm(`${month + 1}月の ${monthGames.length}件 を削除しますか？`)) {
      const batch = writeBatch(db);
      monthGames.forEach((game) => batch.delete(doc(db, "games", game.id)));
      await batch.commit();
    }
  };

  const handleCsvUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const text = event.target.result as string;
        const rows = text.split(/\r?\n/).map(row => row.split(",").map(cell => cell.trim()));
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (rows[i][0]?.includes("日") && (rows[i][3]?.includes("練習") || rows[i][1]?.includes("曜"))) { headerIdx = i; break; }
        }
        if (headerIdx === -1) throw new Error("CSV形式エラー");

        const firstRowStr = toHalfWidth(rows[0][0] || "");
        const monthMatch = firstRowStr.match(/(\d+)月/);
        const targetMonth = monthMatch ? parseInt(monthMatch[1]) : 0;
        const targetYear = firstRowStr.includes("2027") ? 2027 : 2026;

        const batch = writeBatch(db);
        let count = 0;
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const dStr = toHalfWidth(row[0] || "");
          if (!dStr || isNaN(parseInt(dStr))) continue;
          const [day, , , pType, loc, tRange, content] = row;
          if (pType === "オフ" || !pType || pType === "／") continue;

          const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${dStr.padStart(2, '0')}`;
          const timeFull = toHalfWidth(tRange || "未定");
          const cfg = getTypeConfig(pType);
          const customId = `${dateStr}_${timeFull.replace(/[:～\-\s]/g, '')}_${loc}`;
          
          batch.set(doc(db, "games", customId), { 
            date: dateStr, 
            time: timeFull, 
            type: cfg.typeId, 
            location: loc || "未定", 
            opponent: content || "", 
            isOff: false, 
            memo: pType 
          });
          count++;
        }
        if (count > 0 && confirm(`${count}件取り込みますか？`)) {
          await batch.commit();
          setCurrent(new Date(targetYear, targetMonth - 1, 1));
        }
      } catch (err: any) { alert(err.message); }
      finally { setIsImporting(false); e.target.value = ""; }
    };
    reader.readAsText(file, "UTF-8");
  };

  const saveGame = async () => {
    if (!inputDate || !location) return alert("日付と場所を入力してください");
    const timeFull = `${startH}:${startM}～${endH}:${endM}`;
    try {
      if (editingGameId) {
        await updateDoc(doc(db, "games", editingGameId), { date: inputDate, time: timeFull, type, location, opponent, isOff });
      } else {
        const customId = `${inputDate}_${startH}${startM}${endH}${endM}_${location}`;
        await setDoc(doc(db, "games", customId), { date: inputDate, time: timeFull, type, location, opponent, isOff, memo: "" });
      }
      resetForm();
    } catch (e: any) { alert(e.message); }
  };

  const resetForm = () => {
    setInputDate(""); setLocation(""); setOpponent(""); setIsOff(false); setEditingGameId(null);
  };

  const startEdit = (g: any) => {
    const [start, end] = g.time.split("～");
    const [sh, sm] = (start || "00:00").split(":");
    const [eh, em] = (end || "00:00").split(":");
    setEditingGameId(g.id);
    setInputDate(g.date);
    setStartH(sh); setStartM(sm);
    setEndH(eh); setEndM(em);
    setType(g.type);
    setLocation(g.location);
    setOpponent(g.opponent || "");
    setIsOff(g.isOff || false);
    setSelectedDate(null);
    window.scrollTo({ top: 400, behavior: 'smooth' });
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
    const dayGames = (gamesByDate[dateStr] || []).sort((a: any, b: any) => a.time.localeCompare(b.time));
    
    // 【修正】確実に日本時間で今日を判定
    const isToday = dateStr === todayStr;
    const hasOff = dayGames.some((g: any) => g.isOff); 

    cells.push(
      <Card 
        key={d} 
        onClick={() => setSelectedDate(dateStr)} 
        className={`p-1 min-h-[100px] cursor-pointer hover:bg-slate-50 transition-colors relative
          ${isToday ? 'bg-yellow-50 ring-4 ring-yellow-400 border-yellow-400 z-10' : dayGames.length > 0 ? 'bg-blue-50/10' : ''}`}
      >
        <div className="flex justify-between items-start mb-1">
          <div className={`text-[10px] font-bold ${isToday ? 'text-yellow-700 bg-yellow-200 px-1 rounded' : 'opacity-40'}`}>
            {d}{isToday && <span className="ml-1 text-[8px]">今日</span>}
          </div>
          {hasOff && (
             <div className="absolute top-1 right-1 w-5 h-5 border-2 border-red-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
             </div>
          )}
        </div>
        <div className="space-y-1">
          {dayGames.map((g: any) => {
            const cfg = getTypeConfig(g.type);
            return (
              <div key={g.id} className={`${cfg.color} text-white text-[7px] md:text-[9px] p-0.5 rounded flex flex-col leading-tight overflow-hidden`}>
                <span className="font-bold border-b border-white/20 whitespace-nowrap">{g.time}</span>
                <span className="truncate">[{cfg.label}]{g.location}{g.opponent && <span className="ml-0.5 italic">vs{g.opponent}</span>}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  const hOpts = Array.from({length:24},(_,i)=>({val:String(i).padStart(2,'0'), label:`${i}時`}));
  const mOpts = ["00","05","10","15","20","25","30","35","40","45","50","55"].map(m=>({val:m, label:`${m}分`}));

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-4 bg-white min-h-screen text-slate-900 pb-20">
      <h1 className="text-xl font-black text-center mb-6">⚽ 部活予定カレンダー</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 bg-slate-100 p-2 rounded-xl gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="bg-slate-700">←</Button>
          <h2 className="text-lg font-black min-w-[120px] text-center">{year}年 {month + 1}月</h2>
          <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="bg-slate-700">→</Button>
        </div>
        <div className="flex items-center gap-2">
           <div className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-red-100">
             <span className="w-2 h-2 rounded-full bg-red-500"></span> 親の休み
           </div>
           {/* 今日ボタンも日本時間基準に修正 */}
           <button onClick={() => {
             const d = getJSTDate();
             setCurrent(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1));
           }} className="text-xs font-bold bg-white text-slate-600 px-4 py-2 rounded-lg border border-slate-200 shadow-sm active:bg-slate-50">今日</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-8">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-bold text-center pb-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'}`}>{d}</div>
        ))}
        {cells}
      </div>

      <Card className={`p-4 md:p-6 border-none relative z-10 transition-colors mb-12 ${editingGameId ? 'bg-blue-50 ring-2 ring-blue-500 shadow-lg' : 'bg-slate-50'}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-400 text-[10px] tracking-widest uppercase">
            {editingGameId ? "Edit Schedule" : "New Schedule"}
          </h3>
          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50 transition">
             <span className="text-[10px] font-bold text-slate-500">親の休みの日として設定</span>
             <input type="checkbox" checked={isOff} onChange={(e) => setIsOff(e.target.checked)} className="w-4 h-4 accent-red-500 cursor-pointer" />
          </label>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 ml-1">日付</label>
              <Input type="date" value={inputDate} onChange={(e:any) => setInputDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 ml-1">区分</label>
              <select className="w-full p-3 rounded-xl border border-slate-300 text-sm font-bold bg-white outline-none" value={type} onChange={(e)=>setType(e.target.value)}>
                <option value="0">🏃 練習</option>
                <option value="1">🤝 トレマ</option>
                <option value="2">🏆 リーグ戦</option>
                <option value="3">⚽ その他</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 ml-1">時間</label>
            <div className="flex flex-wrap items-center gap-1 bg-white p-2 rounded-xl border border-slate-300">
              <div className="flex items-center flex-1 gap-1">
                <Select value={startH} onChange={setStartH} options={hOpts} />
                <Select value={startM} onChange={setStartM} options={mOpts} />
              </div>
              <span className="text-[10px] font-bold text-slate-300 px-1">～</span>
              <div className="flex items-center flex-1 gap-1">
                <Select value={endH} onChange={setEndH} options={hOpts} />
                <Select value={endM} onChange={setEndM} options={mOpts} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 ml-1">場所</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setLocation("1G")} className="flex-1 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition">1G</button>
                <button onClick={() => setLocation("2G")} className="flex-1 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition">2G</button>
              </div>
              <Input placeholder="場所を自由入力" value={location} onChange={(e:any) => setLocation(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 ml-1">対戦相手・内容</label>
              <Input placeholder="例: 対鳥商" value={opponent} onChange={(e:any) => setOpponent(e.target.value)} />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={saveGame} className={`flex-1 py-4 rounded-2xl shadow-lg mt-2 ${editingGameId ? 'bg-green-600 hover:bg-green-700' : ''}`}>
              {editingGameId ? "変更を保存する" : "予定を登録する"}
            </Button>
            {editingGameId && <button onClick={resetForm} className="mt-2 px-4 text-xs font-bold text-slate-400 hover:text-slate-600">キャンセル</button>}
          </div>
        </div>
      </Card>

      {/* CSVインポートエリア（スマホ対応設定を維持） */}
      <div className="mt-16 pt-8 border-t-2 border-slate-100">
        <h3 className="text-center font-black text-slate-300 text-[10px] tracking-widest mb-6 uppercase">Admin Settings</h3>
        <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-xs text-center">
              <label className="block text-xs font-bold text-slate-500 mb-2">📅 スケジュールCSV取り込み</label>
              <input 
                type="file" 
                accept=".csv, text/csv, application/vnd.ms-excel" 
                onChange={handleCsvUpload} 
                disabled={isImporting} 
                className="text-xs w-full bg-white p-3 rounded-xl border border-slate-200 cursor-pointer" 
              />
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button onClick={deleteMonthData} className="text-xs font-bold text-orange-600 bg-white border border-orange-100 px-6 py-3 rounded-xl shadow-sm hover:bg-orange-50 transition">🗑️ {month + 1}月のデータ削除</button>
              <button onClick={clearAllData} className="text-xs font-bold text-red-500 bg-white border border-red-100 px-6 py-3 rounded-xl shadow-sm hover:bg-red-50 transition">🔥 全データ削除</button>
            </div>
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
               <h3 className="text-xl font-black">{selectedDate.replace(/-/g, "/")}</h3>
               {gamesByDate[selectedDate]?.some((g:any)=>g.isOff) && (
                 <span className="text-[10px] font-bold bg-red-500 text-white px-3 py-1 rounded-full shadow-sm">休みの日</span>
               )}
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {(gamesByDate[selectedDate] || []).map((g: any) => {
                const cfg = getTypeConfig(g.type);
                return (
                  <div key={g.id} className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm relative">
                    <span className={`${cfg.color} text-white text-[11px] px-3 py-1 rounded-full font-bold mb-3 inline-block shadow-sm`}>{cfg.full}</span>
                    <div className="text-2xl font-black text-blue-600 mb-1">🕒 {g.time}</div>
                    <div className="font-black text-xl text-slate-800 mb-3">📍 {g.location}</div>
                    {g.opponent && (
                      <div className="bg-slate-100 p-3 rounded-xl border-l-4 border-blue-500 text-slate-700 font-black">{g.opponent}</div>
                    )}
                    <div className="flex gap-6 mt-4 pt-3 border-t border-slate-100">
                      <button onClick={() => startEdit(g)} className="text-blue-500 text-xs font-bold flex items-center gap-1 hover:underline"><span>✏️</span> 編集</button>
                      <button onClick={() => { if(confirm("削除しますか？")) deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); }} className="text-red-400 text-xs font-bold flex items-center gap-1 hover:underline"><span>🗑️</span> 削除</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full mt-6 py-4 bg-slate-900 rounded-2xl text-lg">閉じる</Button>
          </div>
        </div>
      )}
    </div>
  );
}