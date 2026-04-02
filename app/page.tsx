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

const TextArea = (props: any) => (
  <textarea {...props} className="w-full border border-gray-300 rounded-xl p-3 text-slate-900 bg-white text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
);

export default function SoccerCalendarApp() {
  const [current, setCurrent] = useState(new Date(2026, 3, 1)); // 初期表示を2026年4月に設定
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // 入力フォーム用ステート
  const [inputDate, setInputDate] = useState(""); 
  const [inputHour, setInputHour] = useState("09"); 
  const [inputMin, setInputMin] = useState("00"); 
  const [type, setType] = useState("0");
  const [location, setLocation] = useState("");
  const [opponent, setOpponent] = useState("");
  const [memo, setMemo] = useState("");

  // Firebaseからリアルタイムでデータを取得
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "games"), (snapshot) => {
      setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // 練習形式の判定と色設定
  const getTypeConfig = (t: string) => {
    const val = t || "";
    if (val.includes("練習試合") || val.includes("トレマ")) return { label: "ト", full: "トレマ", color: "bg-green-600", typeId: "1" };
    if (val.includes("リーグ") || val.includes("公式戦") || val.includes("わかとり")) return { label: "リ", full: "リーグ戦", color: "bg-blue-600", typeId: "2" };
    if (val.includes("練習")) return { label: "練", full: "練習", color: "bg-gray-500", typeId: "0" };
    return { label: "他", full: "他試合", color: "bg-orange-500", typeId: "3" };
  };

  // 全角数字を半角に変換するユーティリティ
  const toHalfWidth = (str: string) => str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

  // CSVインポート処理
  const handleCsvUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event: any) => {
      try {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).filter((line: string) => line.trim() !== "").map((row: string) => row.split(","));

        // --- 1. レイアウトチェック (2行目) ---
        const header = rows[1];
        if (!header || header[0] !== "日" || header[3] !== "練習") {
          throw new Error("CSVのレイアウトが正しくありません。1列目が「日」、4列目が「練習」であることを確認してください。");
        }

        // --- 2. 年月の特定 ---
        const firstLine = rows[0][0] || "";
        const cleanFirstLine = toHalfWidth(firstLine);
        const monthMatch = cleanFirstLine.match(/(\d+)月/);
        const targetMonth = monthMatch ? parseInt(monthMatch[1]) : 0;
        const targetYear = 2026;

        if (targetMonth === 0) {
          throw new Error("CSVの1行目から「◯月」を判定できませんでした。");
        }

        const batch = writeBatch(db);
        let count = 0;

        // --- 3. データ行の精査 (3行目から開始) ---
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          const [day, , , practiceType, loc, timeRange, content] = row;
          
          if (!day || isNaN(parseInt(toHalfWidth(day)))) continue;
          
          const typeStr = (practiceType || "").trim();
          if (typeStr === "オフ" || typeStr === "" || typeStr === "／") continue;

          // 時間の抽出 (空欄や不正な形式の場合は 09:00)
          let startTime = "09:00";
          if (timeRange && timeRange.includes(":")) {
            const extracted = toHalfWidth(timeRange).split("～")[0].trim();
            if (extracted.includes(":")) startTime = extracted.padStart(5, '0');
          }

          const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${toHalfWidth(day).padStart(2, '0')}`;
          const fullDateTime = `${dateStr}T${startTime}`;
          const config = getTypeConfig(typeStr);

          const newDocRef = doc(collection(db, "games"));
          batch.set(newDocRef, {
            date: fullDateTime,
            type: config.typeId,
            location: loc || "未定",
            opponent: content || "",
            memo: typeStr
          });
          count++;
        }

        if (count > 0) {
          if (confirm(`${targetYear}年${targetMonth}月の予定を ${count} 件取り込みますか？`)) {
            await batch.commit();
            alert("取り込みが完了しました！");
          }
        } else {
          alert("取り込める予定が見つかりませんでした。");
        }
      } catch (err: any) {
        alert(`【エラー】${err.message}`);
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };

    reader.readAsText(file, "Shift-JIS");
  };

  // 手動保存
  const addGame = async () => {
    if (!inputDate || !location) { alert("日付と場所を入力してください"); return; }
    const fullDateTime = `${inputDate}T${inputHour}:${inputMin}`;
    await addDoc(collection(db, "games"), { date: fullDateTime, type, location, opponent, memo });
    setInputDate(""); setLocation(""); setOpponent(""); setMemo("");
  };

  // カレンダー描画ロジック
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

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900 font-sans">
      <h1 className="text-xl font-black mb-4 text-center text-slate-900">⚽ 練習カレンダー</h1>

      {/* インポートエリア */}
      <div className="mb-6 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-3">
        <div className="text-center">
          <p className="text-xs font-black text-slate-700">スプレッドシートから取り込む</p>
          <p className="text-[10px] text-slate-400">※CSV形式を選択してください</p>
        </div>
        <input 
          type="file" 
          accept=".csv, text/csv, application/vnd.ms-excel" 
          disabled={isImporting}
          onChange={handleCsvUpload} 
          className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-slate-700 file:text-white cursor-pointer" 
        />
      </div>

      {/* カレンダー操作 */}
      <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <Button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="bg-slate-700">←</Button>
        <div className="text-lg font-black text-slate-800">{year}年 {month + 1}月</div>
        <Button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="bg-slate-700">→</Button>
      </div>

      {/* カレンダー表示 */}
      <div className="grid grid-cols-7 gap-1 mb-6 text-center">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div key={d} className={`text-[10px] font-black ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"}`}>{d}</div>
        ))}
        {cells}
      </div>

      {/* 詳細モーダル */}
      {selectedDate && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-slate-800 border-b pb-2">{selectedDate.replace(/-/g, "/")}</h3>
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {(gamesByDate[selectedDate] || []).map((g: any) => {
                const config = getTypeConfig(g.type === "1" ? "トレマ" : g.type === "2" ? "公式戦" : "練習");
                return (
                  <div key={g.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative shadow-sm">
                    <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black mb-2 text-white ${config.color}`}>{config.full}</div>
                    <div className="text-lg font-black text-slate-900 leading-tight">📍 {g.location}</div>
                    <div className="text-sm font-bold text-blue-600 mt-1">🕒 {g.date.split("T")[1]} 開始</div>
                    {g.opponent && <div className="text-xs text-slate-500 mt-2">{g.opponent}</div>}
                    <button onClick={() => { if(confirm("削除しますか？")) deleteDoc(doc(db, "games", g.id)); setSelectedDate(null); }} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 text-[10px] font-black">削除</button>
                  </div>
                );
              })}
              {(gamesByDate[selectedDate] || []).length === 0 && <p className="text-center text-slate-400 py-10">予定はありません</p>}
            </div>
            <Button onClick={() => setSelectedDate(null)} className="w-full py-4 bg-slate-900 rounded-2xl">閉じる</Button>
          </div>
        </div>
      )}

      {/* 手動登録フォーム (日本語) */}
      <Card className="p-6 max-w-md mx-auto bg-slate-50 border-none ring-1 ring-slate-200 shadow-xl mb-10">
        <h2 className="text-sm font-black mb-6 text-slate-500 uppercase tracking-widest text-center">予定を手動で登録</h2>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-black text-slate-600 ml-1">日付</label>
            <Input type="date" value={inputDate} onChange={(e: any) => setInputDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-600 ml-1">開始時間</label>
            <div className="flex gap-2">
              <select className="flex-1 border border-slate-200 rounded-xl p-3 bg-white text-sm font-bold" value={inputHour} onChange={(e) => setInputHour(e.target.value)}>
                {hours.map(h => <option key={h} value={h}>{h}時</option>)}
              </select>
              <select className="flex-1 border border-slate-200 rounded-xl p-3 bg-white text-sm font-bold" value={inputMin} onChange={(e) => setInputMin(e.target.value)}>
                {minutes.map(m => <option key={m} value={m}>{m}分</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-600 ml-1">練習形式</label>
            <select className="w-full border border-slate-200 rounded-xl p-3 bg-white text-sm font-bold" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="0">🏃 練習</option>
              <option value="1">🤝 トレマ</option>
              <option value="2">🏆 リーグ戦</option>
              <option value="3">⚽ 他試合</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-600 ml-1">場所</label>
            <Input placeholder="練習場所" value={location} onChange={(e: any) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-600 ml-1">備考</label>
            <Input placeholder="対戦相手など" value={opponent} onChange={(e: any) => setOpponent(e.target.value)} />
          </div>
          <Button onClick={addGame} className="w-full py-4 rounded-2xl shadow-xl shadow-blue-200 bg-blue-600">保存する</Button>
        </div>
      </Card>
    </div>
  );
}