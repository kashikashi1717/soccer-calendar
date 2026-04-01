"use client";

import { useState, useEffect } from "react";
// Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";

// --- Firebase設定（あなたのものに差し替えてください） ---
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

// --- 簡易コンポーネント定義 (shadcnエラーを回避) ---
const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white border rounded-xl shadow-sm ${className}`}>{children}</div>
);
const Button = ({ children, onClick, className = "" }: any) => (
  <button onClick={onClick} className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition ${className}`}>{children}</button>
);
const Input = (props: any) => (
  <input {...props} className="w-full border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
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

// Firestoreリアルタイム取得（デバッグ版）
  useEffect(() => {
    console.log("Firestore 読み込み開始...");
    const unsubscribe = onSnapshot(
      collection(db, "games"), 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("データ取得成功:", list); // ← これがコンソールに出るか確認
        setGames(list);
      },
      (error) => {
        console.error("Firestore 読み込みエラー:", error); // ← エラーがあればここに出る
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
	  
	  // "2024-05-26T10:00" の先頭から "2024-05-26" だけを抽出
	  const key = g.date.substring(0, 10); 
	  
	  if (!acc[key]) acc[key] = [];
	  acc[key].push(g);
	  return acc;
	}, {});

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="p-2 border border-transparent" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const key = formatDateKey(dateObj);
    const dayGames = gamesByDate[key] || [];

    cells.push(
      <Card key={d} className="p-2 min-h-[110px] overflow-y-auto">
        <div className="text-sm font-bold border-b mb-1">{d}</div>
        <div className="space-y-1">
          {dayGames.map((g: any) => (
            <div key={g.id} className={`text-[10px] p-1 rounded ${g.type === "リーグ戦" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
              <div className="font-bold">{g.type}</div>
              <div>vs {g.opponent}</div>
              <div className="text-gray-500 truncate">{g.location}</div>
              <button onClick={() => deleteGame(g.id)} className="text-red-500 mt-1 block">削除</button>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center">⚽ 試合カレンダー（共有版）</h1>

      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm">
        <Button onClick={prevMonth}>← 前月</Button>
        <div className="text-xl font-bold text-gray-700">{year}年 {month + 1}月</div>
        <Button onClick={nextMonth}>次月 →</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-8">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, index) => (
          <div key={d} className={`text-center font-bold p-2 ${index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-gray-600"}`}>
            {d}
          </div>
        ))}
        {cells}
      </div>

      <Card className="p-6 max-w-md mx-auto">
        <h2 className="text-lg font-bold mb-4 border-b pb-2">試合予定の追加</h2>
        <div className="space-y-3">
          <label className="block text-sm font-medium">日時</label>
          <Input type="datetime-local" value={date} onChange={(e: any) => setDate(e.target.value)} />
          
          <label className="block text-sm font-medium">対戦相手</label>
          <Input placeholder="例: 〇〇中学校" value={opponent} onChange={(e: any) => setOpponent(e.target.value)} />
          
          <label className="block text-sm font-medium">場所</label>
          <Input placeholder="例: 中央公園グラウンド" value={location} onChange={(e: any) => setLocation(e.target.value)} />

          <label className="block text-sm font-medium">種類</label>
          <select className="w-full border rounded-md p-2 mb-4" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="リーグ戦">リーグ戦</option>
            <option value="練習試合">練習試合</option>
          </select>

          <Button onClick={addGame} className="w-full py-3 text-lg">試合を追加する</Button>
        </div>
      </Card>
    </div>
  );
}