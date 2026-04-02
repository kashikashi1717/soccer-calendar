"use client";

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";

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

// --- コンポーネント ---
const Card = ({ children, className = "", onClick }: any) => (
  <div onClick={onClick} className={`bg-white border border-gray-200 rounded-xl shadow-sm text-slate-900 ${className}`}>{children}</div>
);
const Button = ({ children, onClick, className = "" }: any) => (
  <button onClick={onClick} className={`px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition ${className}`}>{children}</button>
);
const Input = (props: any) => (
  <input {...props} className="w-full border border-gray-300 rounded-md p-2 mb-2 text-slate-900 bg-white text-sm" />
);
const TextArea = (props: any) => (
  <textarea {...props} className="w-full border border-gray-300 rounded-md p-2 mb-2 text-slate-900 bg-white text-sm h-20 resize-none" />
);

// --- ヘルパー ---
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SoccerCalendarApp() {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("練習");
  const [memo, setMemo] = useState(""); // 備考

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addGame = async () => {
    if (!date || !opponent || !location) { alert("入力漏れがあります"); return; }
    await addDoc(collection(db, "games"), { date, opponent, location, type, memo });
    setDate(""); setOpponent(""); setLocation(""); setType("練習"); setMemo("");
  };

  const deleteGame = async (id: string) => {
    if (confirm("この予定を削除しますか？")) {
      await deleteDoc(doc(db, "games", id));
    }
  };

  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();

  const gamesByDate = games.reduce((acc: any, g: any) => {
    if (!g.date) return acc;
    const key = g.date.substring(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="p-1 border border-transparent" />);
  }

  // 形式ごとの略称と色設定
  const getTypeConfig = (t: string) => {
    switch (t) {
      case "練習": return { label: "練", color: "bg-gray-500" };
      case "トレマ": return { label: "ト", color: "bg-green-600" };
      case "リーグ戦": return { label: "リ", color: "bg-blue-600" };
      case "他試合": return { label: "他", color: "bg-orange-500" };
      default: return { label: "？", color: "bg-slate-400" };
    }
  };

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateKey(new Date(year, month, d));
    const dayGames = gamesByDate[dateStr] || [];

    cells.push(
      <Card 
        key={d} 
        onClick={() => setSelectedDate(dateStr)} 
        className={`p-1 min-h-[85px] cursor-pointer hover:bg-blue-50 transition-colors ${dayGames.length > 0 ? 'border-blue-200 bg-blue-50/20' : ''}`}
      >
        <div className="text-[10px] font-black border-b border-gray-100 mb-1 text-slate-800">{d}</div>
        <div className="space-y-0.5">
          {dayGames.slice(0, 3).map((g: any) => {
            const config = getTypeConfig(g.type);
            return (
              <div key={g.id} className={`text-[9px] truncate rounded px-1 flex items-center gap-0.5 text-white ${config.color}`}>
                <span className="font-black shrink-0">[{config.label}]</span>
                <span className="truncate">{g.opponent}</span>
              </div>
            );
          })}
          {dayGames.length > 3 && <div className="text-[8px] text-gray-400 text-center">...</div>}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900 relative font-sans">
      <h1 className="text-xl font-black mb-4 text-center tracking-tight">⚽ 試合カレンダー（蒼一朗）</h1>

      <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="px-3 bg-slate-700">←</Button>
        <div className="text-lg font-black text-slate-800">{year}年 {month + 1}月</div>
        <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="px-3 bg-slate-700">→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-black uppercase ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{d}</div>
        ))}
        {cells}
      </div>

      {/* 詳細表示モーダル */}
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xl font-black text-slate-800">{selectedDate.replace(/-/g, "/")}</h3>
              <button onClick={() => setSelectedDate(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 text-xl font-bold">&times;</button>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
              {gamesByDate[selectedDate]?.length > 0 ? (
                gamesByDate[selectedDate].map((g: any) => (
                  <div key={g.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative">
                    <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black mb-2 shadow-sm text-white ${getTypeConfig(g.type).color}`}>
                      {g.type}
                    </div>
                    <div className="text-lg font-black text-slate-900 leading-tight">vs {g.opponent}</div>
                    <div className="text-sm text-slate-600 mt-2 font-medium">📍 {g.location}</div>
                    <div className="text-sm text-slate-500 font-medium">⏰ {g.date.split("T")[1]} 開始</div>
                    {g.memo && (
                      <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                        <span className="font-bold block text-[10px] text-slate-400 mb-1">備考:</span>
                        {g.memo}
                      </div>
                    )}
                    <button onClick={() => { deleteGame(g.id); setSelectedDate(null); }} className="absolute top-4 right-4 text-red-500 text-[10px] font-black bg-white border border-red-100 px-2 py-1 rounded-lg shadow-sm">削除</button>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-slate-300 text-sm font-bold italic">No Schedule</p>
              )}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full py-4 bg-slate-900 rounded-2xl">閉じる</Button>
          </div>
        </div>
      )}

      {/* 追加フォーム */}
      <Card className="p-5 max-w-md mx-auto bg-slate-50 border-none ring-1 ring-slate-200 shadow-none">
        <h2 className="text-sm font-black mb-4 text-slate-500 uppercase tracking-widest">予定を追加</h2>
        <div className="space-y-3">
          <Input type="datetime-local" value={date} onChange={(e: any) => setDate(e.target.value)} />
          <Input placeholder="対戦相手" value={opponent} onChange={(e: any) => setOpponent(e.target.value)} />
          <Input placeholder="場所" value={location} onChange={(e: any) => setLocation(e.target.value)} />
          
          <div className="grid grid-cols-2 gap-2">
            <select className="border border-slate-200 rounded-xl p-3 bg-white text-sm font-bold" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="練習">🏃 練習</option>
              <option value="トレマ">🤝 トレマ</option>
              <option value="リーグ戦">🏆 リーグ戦</option>
              <option value="他試合">⚽ 他試合</option>
            </select>
            <div className="text-[10px] text-slate-400 flex items-center">形式を選択してください</div>
          </div>

          <TextArea placeholder="備考・メモ（集合時間、持ち物など）" value={memo} onChange={(e: any) => setMemo(e.target.value)} />
          
          <Button onClick={addGame} className="w-full py-4 text-md mt-2 rounded-2xl shadow-xl shadow-blue-100">保存する</Button>
        </div>
      </Card>
    </div>
  );
}