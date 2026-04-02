"use client";

import { useState, useEffect } from "react";
// Firebase
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

// --- 簡易コンポーネント定義 (スマホで見やすいよう bg-white と text-slate-900 を固定) ---
const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm text-slate-900 ${className}`}>{children}</div>
);
const Button = ({ children, onClick, className = "" }: any) => (
  <button onClick={onClick} className={`px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition ${className}`}>{children}</button>
);
const Input = (props: any) => (
  <input {...props} className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 text-slate-900 bg-white" />
);

// --- ヘルパー関数 ---
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

  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("リーグ戦");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "games"), 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGames(list);
      }
    );
    return () => unsubscribe();
  }, []);
  
  const addGame = async () => {
    if (!date || !opponent || !location) {
        alert("入力漏れがあります");
        return;
    }
    await addDoc(collection(db, "games"), {
      date,
      opponent,
      location,
      type
    });
    setDate("");
    setOpponent("");
    setLocation("");
    setType("リーグ戦");
  };

  const deleteGame = async (id: string) => {
    if(confirm("削除しますか？")) {
        await deleteDoc(doc(db, "games", id));
    }
  };

  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

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
    const dateObj = new Date(year, month, d);
    const key = formatDateKey(dateObj);
    const dayGames = gamesByDate[key] || [];

    cells.push(
      <Card key={d} className="p-1 min-h-[90px] overflow-hidden flex flex-col">
        <div className="text-xs font-bold border-b border-gray-100 mb-1 text-slate-800">{d}</div>
        <div className="space-y-1 flex-grow">
          {dayGames.map((g: any) => (
            <div key={g.id} className={`text-[9px] p-1 rounded leading-tight ${g.type === "リーグ戦" ? "bg-blue-100 text-blue-900" : "bg-green-100 text-green-900"}`}>
              <div className="font-extrabold">{g.type === "リーグ戦" ? "リ" : "練"} vs{g.opponent}</div>
              <div className="text-[8px] opacity-80 truncate">{g.location}</div>
              <button onClick={() => deleteGame(g.id)} className="text-[8px] text-red-600 font-bold underline mt-1">消</button>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    // 全体を bg-white と text-slate-900 で固定
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900">
      <h1 className="text-xl font-extrabold mb-4 text-center text-slate-900">⚽ 試合カレンダー（蒼一朗）</h1>

      <div className="flex justify-between items-center mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
        <Button onClick={prevMonth} className="text-sm px-2 py-1">←</Button>
        <div className="text-lg font-bold text-slate-800">{year}年 {month + 1}月</div>
        <Button onClick={nextMonth} className="text-sm px-2 py-1">→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, index) => (
          <div key={d} className={`text-center text-xs font-bold p-1 ${index === 0 ? "text-red-600" : index === 6 ? "text-blue-600" : "text-slate-500"}`}>
            {d}
          </div>
        ))}
        {cells}
      </div>

      <Card className="p-4 max-w-md mx-auto bg-gray-50 border-2">
        <h2 className="text-md font-bold mb-3 border-b border-gray-300 pb-1 text-slate-900">試合予定の追加</h2>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">日時</label>
          <Input type="datetime-local" value={date} onChange={(e: any) => setDate(e.target.value)} />
          
          <label className="block text-xs font-bold text-slate-700">対戦相手</label>
          <Input placeholder="例: 〇〇中学校" value={opponent} onChange={(e: any) => setOpponent(e.target.value)} />
          
          <label className="block text-xs font-bold text-slate-700">場所</label>
          <Input placeholder="例: 中央公園" value={location} onChange={(e: any) => setLocation(e.target.value)} />

          <label className="block text-xs font-bold text-slate-700">種類</label>
          <select className="w-full border border-gray-300 rounded-md p-2 mb-3 bg-white text-slate-900 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="リーグ戦">リーグ戦</option>
            <option value="練習試合">練習試合</option>
          </select>

          <Button onClick={addGame} className="w-full py-3 text-md shadow-md">試合を追加する</Button>
        </div>
      </Card>
    </div>
  );
}