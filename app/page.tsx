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
  <input {...props} className="w-full border border-gray-300 rounded-md p-2 mb-2 text-slate-900 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
);
const TextArea = (props: any) => (
  <textarea {...props} className="w-full border border-gray-300 rounded-md p-2 mb-2 text-slate-900 bg-white text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
);

export default function SoccerCalendarApp() {
  const [current, setCurrent] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [type, setType] = useState("0");
  const [location, setLocation] = useState("");
  const [opponent, setOpponent] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getTypeConfig = (t: any) => {
    const val = String(t);
    if (val === "0" || val === "練習") return { label: "練", full: "練習", color: "bg-gray-500" };
    if (val === "1" || val === "トレマ") return { label: "ト", full: "トレマ", color: "bg-green-600" };
    if (val === "2" || val === "リーグ戦") return { label: "リ", full: "リーグ戦", color: "bg-blue-600" };
    if (val === "3" || val === "他試合") return { label: "他", full: "他試合", color: "bg-orange-500" };
    return { label: "？", full: "不明", color: "bg-slate-400" };
  };

  const addGame = async () => {
    if (!date || !location) { alert("日付と場所を入力してください"); return; }
    await addDoc(collection(db, "games"), { date, type, location, opponent, memo });
    setDate(""); setType("0"); setLocation(""); setOpponent(""); setMemo("");
  };

  const deleteGame = async (id: string) => {
    if (confirm("この予定を削除しますか？")) await deleteDoc(doc(db, "games", id));
  };

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
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="p-1" />);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayGames = (gamesByDate[dateStr] || []).sort((a: any, b: any) => a.date.localeCompare(b.date));

    cells.push(
      <Card key={d} onClick={() => setSelectedDate(dateStr)} className={`p-1 min-h-[100px] cursor-pointer flex flex-col ${dayGames.length > 0 ? 'bg-blue-50/20 border-blue-200' : 'border-slate-100'}`}>
        <div className="text-[10px] font-black border-b border-gray-50 mb-1 text-slate-800">{d}</div>
        <div className="flex-1 space-y-1 overflow-hidden">
          {dayGames.slice(0, 2).map((g: any) => {
            const config = getTypeConfig(g.type);
            const time = g.date.split("T")[1] || "";
            return (
              <div key={g.id} className={`rounded px-0.5 text-white font-normal ${config.color} leading-tight py-0.5 shadow-sm`}>
                <div className="text-[8px] font-bold border-b border-white/20 mb-0.5 tracking-tighter">{time}〜</div>
                <div className="text-[9px] truncate flex items-center gap-0.5">
                  <span className="shrink-0 font-bold">[{config.label}]</span>
                  <span className="truncate">{g.location}</span>
                </div>
              </div>
            );
          })}
          {dayGames.length > 2 && <div className="text-[7px] text-slate-400 text-center font-bold">...他</div>}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900 font-sans">
      <meta charSet="utf-8" />
      <h1 className="text-xl font-black mb-4 text-center tracking-tight">⚽ 練習カレンダー</h1>

      <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
        <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="px-3 bg-slate-700 shadow-sm">←</Button>
        <div className="text-lg font-black text-slate-800 tracking-tighter">{year}年 {month + 1}月</div>
        <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="px-3 bg-slate-700 shadow-sm">→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6 text-center">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-black uppercase ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{d}</div>
        ))}
        {cells}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-800 border-b pb-2">{selectedDate.replace(/-/g, "/")}</h3>
            <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
              {(gamesByDate[selectedDate] || []).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((g: any) => {
                const config = getTypeConfig(g.type);
                return (
                  <div key={g.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative shadow-sm">
                    <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black mb-2 text-white ${config.color}`}>{config.full}</div>
                    <div className="text-lg font-black text-slate-900 leading-tight flex items-start gap-1">
                      <span className="shrink-0">📍</span> {g.location}
                    </div>
                    <div className="text-md font-bold text-slate-600 mt-1 pl-6">{g.opponent ? `vs ${g.opponent}` : "練習・予定"}</div>
                    <div className="text-sm text-blue-600 mt-3 font-black flex items-center bg-blue-50 w-fit px-2 py-1 rounded-lg">
                      🕒 {g.date.split("T")[1]} 開始
                    </div>
                    {g.memo && (
                      <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {g.memo}
                      </div>
                    )}
                    <button onClick={() => { deleteGame(g.id); setSelectedDate(null); }} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 text-[10px] font-black transition-colors">削除</button>
                  </div>
                );
              })}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full py-4 bg-slate-900 rounded-2xl shadow-lg">閉じる</Button>
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      <Card className="p-6 max-w-md mx-auto bg-slate-50 border-none ring-1 ring-slate-200 shadow-xl mb-10">
        <h2 className="text-sm font-black mb-6 text-slate-400 uppercase tracking-widest text-center italic">Add New Schedule</h2>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-500 ml-1 uppercase">Date & Time</label>
            {/* step="300" で5分刻みに設定 */}
            <Input type="datetime-local" step="300" value={date} onChange={(e: any) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 ml-1 uppercase">Type</label>
            <select className="w-full border border-slate-200 rounded-xl p-3 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="0">🏃 練習</option>
              <option value="1">🤝 トレマ</option>
              <option value="2">🏆 リーグ戦</option>
              <option value="3">⚽ 他試合</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 ml-1 uppercase">Location</label>
            <Input placeholder="練習場所・会場" value={location} onChange={(e: any) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 ml-1 uppercase">Opponent</label>
            <Input placeholder="対戦相手名" value={opponent} onChange={(e: any) => setOpponent(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 ml-1 uppercase">Memo</label>
            <TextArea placeholder="持ち物、集合時間など" value={memo} onChange={(e: any) => setMemo(e.target.value)} />
          </div>
          <Button onClick={addGame} className="w-full py-4 rounded-2xl shadow-xl shadow-blue-200 bg-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all">予定を保存する</Button>
        </div>
      </Card>
    </div>
  );
}