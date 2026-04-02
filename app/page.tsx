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
  <input {...props} className="w-full border border-gray-300 rounded-md p-2 mb-2 text-slate-900 bg-white" />
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // タップされた日を管理

  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("リーグ戦");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addGame = async () => {
    if (!date || !opponent || !location) { alert("入力漏れがあります"); return; }
    await addDoc(collection(db, "games"), { date, opponent, location, type });
    setDate(""); setOpponent(""); setLocation(""); setType("リーグ戦");
  };

  const deleteGame = async (id: string) => {
    if (confirm("この試合を削除しますか？")) {
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

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateKey(new Date(year, month, d));
    const dayGames = gamesByDate[dateStr] || [];

    cells.push(
      <Card 
        key={d} 
        onClick={() => setSelectedDate(dateStr)} // 日付タップで選択
        className={`p-1 min-h-[85px] cursor-pointer hover:bg-blue-50 transition-colors ${dayGames.length > 0 ? 'border-blue-300 bg-blue-50/30' : ''}`}
      >
        <div className="text-xs font-bold border-b border-gray-100 mb-1 text-slate-800">{d}</div>
        <div className="space-y-1">
          {dayGames.slice(0, 2).map((g: any) => (
            <div key={g.id} className="text-[9px] truncate bg-blue-600 text-white rounded px-1">
              {g.opponent}
            </div>
          ))}
          {dayGames.length > 2 && <div className="text-[8px] text-gray-400 text-center">他{dayGames.length - 2}件</div>}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900 relative">
      <h1 className="text-xl font-extrabold mb-4 text-center">⚽ 試合カレンダー（蒼一朗）</h1>

      <div className="flex justify-between items-center mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
        <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="px-3">←</Button>
        <div className="text-lg font-bold">{year}年 {month + 1}月</div>
        <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="px-3">→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-center text-xs font-bold ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-slate-400"}`}>{d}</div>
        ))}
        {cells}
      </div>

      {/* 詳細表示モーダル */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-bold text-blue-900">{selectedDate.replace(/-/g, "/")} の詳細</h3>
              <button onClick={() => setSelectedDate(null)} className="text-2xl text-gray-400">&times;</button>
            </div>
            
            <div className="max-h-[40vh] overflow-y-auto space-y-3">
              {gamesByDate[selectedDate]?.length > 0 ? (
                gamesByDate[selectedDate].map((g: any) => (
                  <div key={g.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 relative">
                    <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1 bg-blue-100 text-blue-700">{g.type}</div>
                    <div className="text-base font-bold text-slate-900">vs {g.opponent}</div>
                    <div className="text-sm text-slate-600 mt-1">📍 {g.location}</div>
                    <div className="text-sm text-slate-500">⏰ {g.date.split("T")[1]}</div>
                    <button onClick={() => { deleteGame(g.id); setSelectedDate(null); }} className="absolute top-3 right-3 text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded">削除</button>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4 text-sm">予定はありません</p>
              )}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full py-3 bg-slate-800">閉じる</Button>
          </div>
        </div>
      )}

      {/* 追加フォーム */}
      <Card className="p-4 max-w-md mx-auto bg-gray-50 border-2 shadow-none">
        <h2 className="text-md font-bold mb-3 border-b border-gray-300 pb-1">試合予定の追加</h2>
        <div className="space-y-2">
          <Input type="datetime-local" value={date} onChange={(e: any) => setDate(e.target.value)} />
          <Input placeholder="対戦相手" value={opponent} onChange={(e: any) => setOpponent(e.target.value)} />
          <Input placeholder="場所" value={location} onChange={(e: any) => setLocation(e.target.value)} />
          <select className="w-full border border-gray-300 rounded-md p-2 bg-white text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="リーグ戦">リーグ戦</option>
            <option value="練習試合">練習試合</option>
          </select>
          <Button onClick={addGame} className="w-full py-3 text-md mt-2">試合を追加</Button>
        </div>
      </Card>
    </div>
  );
}