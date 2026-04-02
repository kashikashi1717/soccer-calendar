"use client";

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, writeBatch, setDoc } from "firebase/firestore";

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

export default function SoccerCalendarApp() {
  const [current, setCurrent] = useState(new Date(2026, 3, 1));
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [inputDate, setInputDate] = useState(""); 
  const [inputHour, setInputHour] = useState("09"); 
  const [inputMin, setInputMin] = useState("00"); 
  const [type, setType] = useState("0");
  const [location, setLocation] = useState("");
  const [opponent, setOpponent] = useState("");

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

  // --- 重複防止機能付きインポート ---
  const handleCsvUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const text = event.target.result as string;
        const rows = text.split(/\r?\n/).map(row => row.split(",").map(cell => cell.trim()));

        let headerIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (rows[i][0]?.includes("日") && rows[i][3]?.includes("練習")) {
            headerIndex = i;
            break;
          }
        }
        if (headerIndex === -1) throw new Error("CSVのレイアウトを認識できませんでした。");

        const firstLine = rows[0][0] || "";
        const cleanTitle = toHalfWidth(firstLine);
        const monthMatch = cleanTitle.match(/(\d+)月/);
        const targetMonth = monthMatch ? parseInt(monthMatch[1]) : 0;
        const targetYear = cleanTitle.includes("2027") ? 2027 : 2026;

        const batch = writeBatch(db);
        let count = 0;

        for (let i = headerIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          const dayStr = toHalfWidth(row[0] || "");
          if (!dayStr || isNaN(parseInt(dayStr))) continue;

          const [day, , , practiceType, loc, timeRange, content] = row;
          const typeStr = practiceType || "";
          if (typeStr === "オフ" || typeStr === "" || typeStr === "／") continue;

          let startTime = "09:00";
          if (timeRange && timeRange.includes(":")) {
            const extracted = toHalfWidth(timeRange).split(/[～\-]/)[0].trim();
            if (extracted.includes(":")) {
              const [h, m] = extracted.split(":");
              startTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
            }
          }

          const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
          const fullDateTime = `${dateStr}T${startTime}`;
          const config = getTypeConfig(typeStr);

          // 【重要】重複防止用のカスタムIDを作成 (日付_時間_場所を連結)
          // これが同じデータは「追加」ではなく「上書き」になる
          const customId = `${dateStr}_${startTime.replace(':', '')}_${(loc || '未定').replace(/\s/g, '')}`;

          batch.set(doc(db, "games", customId), {
            date: fullDateTime,
            type: config.typeId,
            location: loc || "未定",
            opponent: content || "",
            memo: typeStr
          });
          count++;
        }

        if (count > 0) {
          if (confirm(`重複をチェックしながら予定を ${count} 件取り込みますか？\n（同じ時間の予定は上書きされます）`)) {
            await batch.commit();
            alert("完了しました！");
            setCurrent(new Date(targetYear, targetMonth - 1, 1));
          }
        }
      } catch (err: any) { alert(`【エラー】${err.message}`); }
      finally { setIsImporting(false); e.target.value = ""; }
    };
    reader.readAsText(file, "UTF-8");
  };

  const addGame = async () => {
    if (!inputDate || !location) return alert("日付と場所を入力してください");
    const fullDateTime = `${inputDate}T${inputHour}:${inputMin}`;
    // 手動追加時も重複防止のためにIDを指定
    const customId = `${inputDate}_${inputHour}${inputMin}_${location.replace(/\s/g, '')}`;
    await setDoc(doc(db, "games", customId), { date: fullDateTime, type, location, opponent, memo: "" });
    setInputDate(""); setLocation(""); setOpponent("");
  };

  // --- カレンダー描画ロジック ---
  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const gamesByDate = games.reduce((acc: any, g: any) => {
    if (!g.date) return acc;
    const key = g.date.substring(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayGames = (gamesByDate[dateStr] || []).sort((a: any, b: any) => a.date.localeCompare(b.date));
    cells.push(
      <Card key={d} onClick={() => setSelectedDate(dateStr)} className={`p-1 min-h-[110px] cursor-pointer hover:bg-slate-50 transition ${dayGames.length > 0 ? 'bg-blue-50/20' : ''}`}>
        <div className="text-[10px] font-bold mb-1 border-b border-slate-50">{d}</div>
        <div className="space-y-1">
          {dayGames.map((g: any) => {
            const cfg = getTypeConfig(g.type);
            return (
              <div key={g.id} className={`${cfg.color} text-white text-[8px] p-0.5 rounded shadow-sm flex flex-col leading-tight`}>
                <span className="font-bold border-b border-white/10 mb-0.5">{g.date.split("T")[1]}</span>
                <span className="truncate">[{cfg.label}]{g.location}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-4 bg-white min-h-screen text-slate-900">
      <h1 className="text-xl font-black text-center mb-6">⚽ 部活予定カレンダー</h1>

      <div className="mb-6 p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center">
        <p className="text-xs font-black text-slate-600 mb-2">CSVファイルを選択してインポート</p>
        <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={isImporting} className="text-xs" />
        <p className="mt-2 text-[10px] text-slate-400">※同じ日時の予定は自動で上書きされます</p>
        {isImporting && <p className="mt-2 text-blue-600 animate-pulse text-xs font-bold">解析中...</p>}
      </div>

      <div className="flex justify-between items-center mb-4 bg-slate-100 p-2 rounded-xl">
        <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="bg-slate-700">←</Button>
        <h2 className="text-lg font-black">{year}年 {month + 1}月</h2>
        <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="bg-slate-700">→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-10 text-center">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'}`}>{d}</div>
        ))}
        {cells}
      </div>

      {/* 詳細モーダル */}
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black border-b pb-2 mb-4">{selectedDate.replace(/-/g, "/")}</h3>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto px-1">
              {(gamesByDate[selectedDate] || []).map((g: any) => {
                const cfg = getTypeConfig(g.type);
                return (
                  <div key={g.id} className="p-4 bg-slate-50 rounded-2xl relative border border-slate-100 shadow-sm">
                    <div className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-black text-white mb-2 ${cfg.color}`}>
                      {cfg.full}
                    </div>
                    <div className="font-black text-lg">📍 {g.location}</div>
                    <div className="text-sm font-bold text-blue-600 mt-1">🕒 {g.date.split("T")[1]} 開始</div>
                    {g.opponent && <div className="text-xs text-slate-500 mt-2 bg-white p-2 rounded-lg border border-slate-100 font-medium">{g.opponent}</div>}
                    <button onClick={() => { if(confirm("削除しますか？")) deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); }} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 text-xs font-bold">削除</button>
                  </div>
                );
              })}
              {(gamesByDate[selectedDate] || []).length === 0 && <p className="text-center text-slate-400 py-10 text-sm">予定はありません</p>}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full mt-6 py-4 bg-slate-900 rounded-2xl">閉じる</Button>
          </div>
        </div>
      )}

      {/* 手動登録フォーム */}
      <Card className="p-6 bg-slate-50 border-none shadow-inner">
        <h3 className="text-center font-black text-slate-500 text-xs uppercase tracking-widest mb-6">手動で予定を追加</h3>
        <div className="grid gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 ml-1">日付</label>
            <Input type="date" value={inputDate} onChange={(e:any) => setInputDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 ml-1">区分</label>
              <select className="w-full p-3 rounded-xl border border-slate-300 text-sm font-bold bg-white" value={type} onChange={(e)=>setType(e.target.value)}>
                <option value="0">🏃 練習</option>
                <option value="1">🤝 トレマ</option>
                <option value="2">🏆 リーグ戦</option>
                <option value="3">⚽ 他試合</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 ml-1">開始時間</label>
              <div className="flex gap-1">
                <select className="flex-1 p-2 rounded-xl border border-slate-300 text-xs bg-white" value={inputHour} onChange={(e)=>setInputHour(e.target.value)}>
                  {Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h}時</option>)}
                </select>
                <select className="flex-1 p-2 rounded-xl border border-slate-300 text-xs bg-white" value={inputMin} onChange={(e)=>setInputMin(e.target.value)}>
                  {["00","15","30","45"].map(m=><option key={m} value={m}>{m}分</option>)}
                </select>
              </div>
            </div>
          </div>
          <Input placeholder="場所" value={location} onChange={(e:any) => setLocation(e.target.value)} />
          <Input placeholder="備考・対戦相手" value={opponent} onChange={(e:any) => setOpponent(e.target.value)} />
          <Button onClick={addGame} className="py-4 rounded-2xl shadow-lg">登録する</Button>
        </div>
      </Card>
    </div>
  );
}