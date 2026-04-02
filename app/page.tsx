"use client";

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, writeBatch } from "firebase/firestore";

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
const Button = ({ children, onClick, className = "", disabled = false }: any) => (
  <button disabled={disabled} onClick={onClick} className={`px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition disabled:bg-slate-300 ${className}`}>{children}</button>
);
const Input = (props: any) => (
  <input {...props} className="w-full border border-gray-300 rounded-xl p-3 text-slate-900 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
);

export default function SoccerCalendarApp() {
  const [current, setCurrent] = useState(new Date(2026, 3, 1)); // 2026年4月
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getTypeConfig = (t: string) => {
    const val = t || "";
    if (val.includes("練習試合") || val.includes("トレマ")) return { label: "ト", full: "トレマ", color: "bg-green-600", typeId: "1" };
    if (val.includes("リーグ") || val.includes("公式戦")) return { label: "リ", full: "リーグ戦", color: "bg-blue-600", typeId: "2" };
    if (val.includes("練習")) return { label: "練", full: "練習", color: "bg-gray-500", typeId: "0" };
    return { label: "他", full: "他試合", color: "bg-orange-500", typeId: "3" };
  };

  // CSVバリデーションと取り込み
  const handleCsvUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event: any) => {
      try {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).map((row: string) => row.split(","));

        // --- 1. レイアウトチェック (ヘッダー確認) ---
        // 期待するヘッダー: 日, 曜日, 学校行事等, 練習, 場所, 時間, 内容, TR場
        const header = rows[1]; // 2行目
        if (!header || header[0] !== "日" || header[3] !== "練習" || header[5] !== "時間") {
          throw new Error("CSVのレイアウトが正しくありません。列の順番や項目名を確認してください。");
        }

        // --- 2. 年月の特定 ---
        const firstLine = rows[0][0] || "";
        const monthMatch = firstLine.match(/(\d+)月/);
        const yearMatch = firstLine.match(/(\d{4})年/);
        const targetYear = yearMatch ? parseInt(yearMatch[1]) : 2026;
        const targetMonth = monthMatch ? parseInt(monthMatch[1]) : 0;

        if (targetMonth === 0) {
          throw new Error("CSVの1行目から「◯月」という情報が見つかりませんでした。");
        }

        const batch = writeBatch(db);
        let count = 0;
        let errors: string[] = [];

        // --- 3. データ行の精査 ---
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 4 || !row[0]) continue; // 空行スキップ

          const [day, , , practiceType, loc, timeRange, content] = row;
          const dayNum = parseInt(day);

          if (isNaN(dayNum)) continue; // 数字じゃない行（余白など）はスキップ
          if (practiceType === "オフ" || !practiceType || practiceType.trim() === "") continue;

          // 時間の抽出バリデーション
          let startTime = "09:00";
          if (timeRange && timeRange.includes(":")) {
            const extracted = timeRange.split("～")[0].trim();
            if (/^\d{1,2}:\d{2}$/.test(extracted)) {
              startTime = extracted.padStart(5, '0');
            }
          }

          try {
            const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const fullDateTime = `${dateStr}T${startTime}`;
            const config = getTypeConfig(practiceType);

            const newDocRef = doc(collection(db, "games"));
            batch.set(newDocRef, {
              date: fullDateTime,
              type: config.typeId,
              location: loc || "未定",
              opponent: content || "",
              memo: `一括取込: ${practiceType}`
            });
            count++;
          } catch (e) {
            errors.push(`${day}日のデータでエラーが発生しました。`);
          }
        }

        if (errors.length > 0) {
          alert(`一部のデータに不備がありました:\n${errors.join("\n")}`);
        }

        if (count > 0) {
          if (confirm(`${targetYear}年${targetMonth}月の予定を ${count} 件取り込みますか？`)) {
            await batch.commit();
            alert("取り込みが完了しました！");
          }
        } else {
          alert("取り込める有効な予定（練習・試合等）が見つかりませんでした。");
        }

      } catch (err: any) {
        alert(`【エラー】${err.message}`);
      } finally {
        setIsImporting(false);
        e.target.value = ""; // 連続アップロード可能にする
      }
    };

    reader.onerror = () => {
      alert("ファイルの読み込み中にエラーが発生しました。");
      setIsImporting(false);
    };

    reader.readAsText(file, "Shift-JIS");
  };

  // カレンダー描画用ロジック（前回のまま）
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
      <Card key={d} onClick={() => setSelectedDate(dateStr)} className={`p-1 min-h-[105px] cursor-pointer flex flex-col ${dayGames.length > 0 ? 'bg-blue-50/20 border-blue-200' : 'border-slate-100'}`}>
        <div className="text-[10px] font-black border-b border-gray-50 mb-1 text-slate-800">{d}</div>
        <div className="flex-1 space-y-1 overflow-hidden">
          {dayGames.slice(0, 2).map((g: any) => {
            const config = getTypeConfig(g.type === "1" ? "トレマ" : g.type === "2" ? "公式戦" : "練習");
            const time = g.date.split("T")[1] || "";
            return (
              <div key={g.id} className={`rounded px-0.5 text-white font-normal ${config.color} leading-tight py-0.5 shadow-sm`}>
                <div className="text-[8px] font-bold border-b border-white/20 mb-0.5">{time}</div>
                <div className="text-[9px] truncate">[{config.label}]{g.location}</div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900 font-sans">
      <h1 className="text-xl font-black mb-4 text-center text-slate-900">⚽ 練習カレンダー</h1>

      {/* エラー処理付きインポートエリア */}
      <div className="mb-6 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-3">
        <div className="text-center">
          <p className="text-xs font-black text-slate-700">CSV一括取り込み</p>
          <p className="text-[10px] text-slate-400">※「日,練習,場所,時間」の列順が必要です</p>
        </div>
        <input 
          type="file" 
          accept=".csv" 
          disabled={isImporting}
          onChange={handleCsvUpload} 
          className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-slate-700 file:text-white cursor-pointer disabled:opacity-50" 
        />
        {isImporting && <p className="text-[10px] text-blue-600 font-bold animate-pulse">解析中...</p>}
      </div>

      <div className="flex justify-between items-center mb-4">
        <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="bg-slate-700">←</Button>
        <div className="text-lg font-black">{year}年 {month + 1}月</div>
        <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="bg-slate-700">→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6 text-center">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-black ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{d}</div>
        ))}
        {cells}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black mb-4 border-b pb-2">{selectedDate}</h3>
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {(gamesByDate[selectedDate] || []).map((g: any) => (
                <div key={g.id} className="p-4 rounded-2xl bg-slate-50 relative border border-slate-100">
                  <div className="text-lg font-black">📍 {g.location}</div>
                  <div className="text-sm font-bold text-blue-600 mt-1">🕒 {g.date.split("T")[1]} 開始</div>
                  <div className="text-xs text-slate-500 mt-2">{g.opponent}</div>
                  <button onClick={() => { if(confirm("削除しますか？")) deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); }} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 font-black text-[10px]">削除</button>
                </div>
              ))}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full mt-4 bg-slate-900 rounded-2xl py-4">閉じる</Button>
          </div>
        </div>
      )}
    </div>
  );
}