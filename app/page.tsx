"use client";

import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, writeBatch } from "firebase/firestore";

// --- Firebase設定 (変更なし) ---
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

export default function SoccerCalendarApp() {
  const [current, setCurrent] = useState(new Date(2026, 3, 1));
  const [games, setGames] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ステート群 (変更なし)
  const [inputDate, setInputDate] = useState(""); 
  const [inputHour, setInputHour] = useState("09"); 
  const [inputMin, setInputMin] = useState("00"); 
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

  const getTypeConfig = (t: string) => {
    const val = t || "";
    if (val.includes("練習試合") || val.includes("トレマ")) return { label: "ト", full: "トレマ", color: "bg-green-600", typeId: "1" };
    if (val.includes("リーグ") || val.includes("公式戦") || val.includes("わかとり")) return { label: "リ", full: "リーグ戦", color: "bg-blue-600", typeId: "2" };
    if (val.includes("練習")) return { label: "練", full: "練習", color: "bg-gray-500", typeId: "0" };
    return { label: "他", full: "他試合", color: "bg-orange-500", typeId: "3" };
  };

  const toHalfWidth = (str: string) => str ? str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : "";

  // --- 改良版 CSVインポート処理 ---
  const handleCsvUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event: any) => {
      try {
        const text = event.target.result as string;
        // 改行と空白を除去しながら行分解
        const rows = text.split(/\r?\n/).map(row => row.split(",").map(cell => cell.trim()));

        // --- 1. ヘッダー行(日, 曜日...がある行)を自動探索 ---
        let headerIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          if (rows[i][0]?.includes("日") && rows[i][3]?.includes("練習")) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          throw new Error("CSVのレイアウトを正しく認識できませんでした。ファイル内に「日」「練習」などの項目名が含まれているか確認してください。");
        }

        // --- 2. 年月の特定 (1行目から取得) ---
        const firstLine = rows[0][0] || "";
        const cleanFirstLine = toHalfWidth(firstLine);
        const monthMatch = cleanFirstLine.match(/(\d+)月/);
        const targetMonth = monthMatch ? parseInt(monthMatch[1]) : 0;
        const targetYear = 2026;

        if (targetMonth === 0) {
          throw new Error("CSVから「◯月」の情報を読み取れませんでした。1行目に「4月 練習日程」のように月を記載してください。");
        }

        const batch = writeBatch(db);
        let count = 0;

        // --- 3. データ行の処理 (ヘッダーの次の行から開始) ---
        for (let i = headerIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0] || isNaN(parseInt(toHalfWidth(row[0])))) continue;

          const [day, , , practiceType, loc, timeRange, content] = row;
          const typeStr = practiceType || "";
          
          if (typeStr === "オフ" || typeStr === "" || typeStr === "／") continue;

          let startTime = "09:00";
          if (timeRange && timeRange.includes(":")) {
            const extracted = toHalfWidth(timeRange).split(/～|-/)[0].trim();
            if (extracted.includes(":")) {
              const [h, m] = extracted.split(":");
              startTime = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
            }
          }

          const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${toHalfWidth(day).padStart(2, '0')}`;
          const fullDateTime = `${dateStr}T${startTime}`;
          const config = getTypeConfig(typeStr);

          batch.set(doc(collection(db, "games")), {
            date: fullDateTime,
            type: config.typeId,
            location: loc || "未定",
            opponent: content || "",
            memo: typeStr
          });
          count++;
        }

        if (count > 0) {
          if (confirm(`${targetMonth}月の予定を ${count} 件取り込みますか？`)) {
            await batch.commit();
            alert("取り込みが完了しました！");
          }
        } else {
          alert("有効な練習予定が見つかりませんでした。");
        }
      } catch (err: any) {
        alert(`【エラー】${err.message}\n※GoogleドライブのCSVなら、このまま選択して改善しない場合は「UTF-8」形式で保存し直してください。`);
      } finally {
        setIsImporting(false);
        e.target.value = "";
      }
    };

    // 読み込み形式: Googleドライブ(UTF-8)を優先しつつ対応
    reader.readAsText(file, "UTF-8"); 
  };

  // カレンダー等のUI部分は以前のコードと同じため省略 (必要に応じてそのまま使用してください)
  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto bg-white min-h-screen text-slate-900 font-sans">
      <h1 className="text-xl font-black mb-4 text-center">⚽ 練習カレンダー</h1>
      
      <div className="mb-6 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-3">
        <p className="text-xs font-black text-slate-700">CSVから取り込む</p>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleCsvUpload} 
          className="text-xs" 
        />
      </div>

      {/* 以下、カレンダー表示やフォームのUIコードが続きます（前回の完全版と同様） */}
    </div>
  );
}