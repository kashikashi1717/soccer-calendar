"use client"; // ← これを追加！

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";

// ★ここにFirebase設定を貼り付け
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

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

export default function SoccerCalendarApp() {
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [games, setGames] = useState([]);

  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("リーグ戦");

  // Firestoreリアルタイム取得
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    });
    return () => unsubscribe();
  }, []);

  const addGame = async () => {
    if (!date || !opponent || !location) return;
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

  const deleteGame = async (id) => {
    await deleteDoc(doc(db, "games", id));
  };

  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const gamesByDate = games.reduce((acc, g) => {
    const key = g.date.split("T")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const key = formatDateKey(dateObj);
    const dayGames = gamesByDate[key] || [];

    cells.push(
      <Card key={d} className="p-2 min-h-[110px]">
        <div className="text-sm font-bold">{d}</div>
        <div className="space-y-1 mt-1">
          {dayGames.map((g) => (
            <div
              key={g.id}
              className={`text-xs p-1 rounded ${
                g.type === "リーグ戦" ? "bg-blue-100" : "bg-green-100"
              }`}
            >
              <div className="font-semibold">{g.type}</div>
              <div>{g.opponent}</div>
              <div className="text-gray-500">{g.location}</div>
              <button
                className="text-red-500 text-[10px]"
                onClick={() => deleteGame(g.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">⚽ 試合カレンダー（共有版）</h1>

      <div className="flex justify-between items-center mb-4">
        <Button onClick={prevMonth}>←</Button>
        <div className="font-bold">{year}年 {month + 1}月</div>
        <Button onClick={nextMonth}>→</Button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className="text-center font-bold">{d}</div>
        ))}
        {cells}
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="対戦相手" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
          <Input placeholder="場所" value={location} onChange={(e) => setLocation(e.target.value)} />

          <select
            className="border rounded p-2"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="リーグ戦">リーグ戦</option>
            <option value="練習試合">練習試合</option>
          </select>

          <Button onClick={addGame}>試合を追加</Button>
        </CardContent>
      </Card>
    </div>
  );
}
