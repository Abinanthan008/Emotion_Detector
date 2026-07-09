import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, Loader2, AlertTriangle, RotateCcw, AudioWaveform } from "lucide-react";

// Point this at your FastAPI server.
const BACKEND_URL = "http://127.0.0.1:8000/predict";

// Order matches INV_EMOTION_MAP in the backend — the 8 bars always mean the same 8 things.
const EMOTIONS = [
  { key: "Neutral",   color: "bg-slate-400",   glow: "shadow-slate-400/40" },
  { key: "Calm",      color: "bg-teal-400",    glow: "shadow-teal-400/40" },
  { key: "Happy",     color: "bg-amber-400",   glow: "shadow-amber-400/40" },
  { key: "Sad",       color: "bg-sky-400",     glow: "shadow-sky-400/40" },
  { key: "Angry",     color: "bg-rose-500",    glow: "shadow-rose-500/40" },
  { key: "Fearful",   color: "bg-violet-400",  glow: "shadow-violet-400/40" },
  { key: "Disgust",   color: "bg-lime-500",    glow: "shadow-lime-500/40" },
  { key: "Surprised", color: "bg-fuchsia-400", glow: "shadow-fuchsia-400/40" },
];

const STATUS = { IDLE: "idle", ANALYZING: "analyzing", DONE: "done", ERROR: "error" };

export default function EmotionUploader() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!/\.(wav|mp3|flac|ogg|m4a)$/i.test(f.name)) {
      setStatus(STATUS.ERROR);
      setErrorMsg("That file type isn't supported. Try WAV, MP3, FLAC, OGG, or M4A.");
      return;
    }
    setFile(f);
    setStatus(STATUS.IDLE);
    setResult(null);
    setErrorMsg("");
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus(STATUS.ANALYZING);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(BACKEND_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "The server couldn't process that file.");
      }
      const data = await res.json();
      setResult(data);
      setStatus(STATUS.DONE);
    } catch (err) {
      setStatus(STATUS.ERROR);
      setErrorMsg(err.message || "Something went wrong reaching the server.");
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setStatus(STATUS.IDLE);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyzing = status === STATUS.ANALYZING;
  const done = status === STATUS.DONE && result;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6 font-sans">
      <style>{`
        @keyframes idleWave {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(0.7); }
        }
        @keyframes activeWave {
          0%, 100% { transform: scaleY(0.15); }
          50% { transform: scaleY(1); }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.015); }
        }
        .bar-idle { animation: idleWave 2.2s ease-in-out infinite; }
        .bar-active { animation: activeWave 0.6s ease-in-out infinite; }
        .float-in { animation: floatIn 0.5s ease-out both; }
        .ring-pulse { animation: ringPulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bar-idle, .bar-active, .float-in, .ring-pulse { animation: none !important; }
        }
      `}</style>

      <div className="w-full max-w-xl">
        {/* Eyebrow + headline */}
        <div className="mb-8 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-amber-400/80 uppercase mb-3">
            Signal Analysis
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-50">
            What's underneath your voice?
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Upload a short clip. We'll read the emotion in it.
          </p>
        </div>

        {/* Main card */}
        <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/40">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative overflow-hidden rounded-xl border-2 border-dashed cursor-pointer
              transition-all duration-300 ease-out
              ${dragActive
                ? "border-amber-400 bg-amber-400/5 scale-[1.01]"
                : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/40"}
            `}
          >
            {dragActive && (
              <div className="absolute inset-0 rounded-xl ring-2 ring-amber-400/50 ring-pulse pointer-events-none" />
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".wav,.mp3,.flac,.ogg,.m4a,audio/*"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />

            <div className="flex flex-col items-center justify-center gap-5 px-6 py-10">
              {/* The 8 bars: ambient by default, energetic while analyzing, a real chart once done */}
              <div className="flex items-end gap-1.5 h-16">
                {EMOTIONS.map((e, i) => {
                  const prob = done ? (result.all_probabilities?.[e.key] ?? 0) : null;
                  const isWinner = done && result.emotion === e.key;
                  return (
                    <div
                      key={e.key}
                      className={`w-3 sm:w-3.5 rounded-full origin-bottom transition-all duration-700 ease-out
                        ${done ? "" : analyzing ? "bar-active" : "bar-idle"}
                        ${done ? e.color : "bg-slate-600"}
                        ${isWinner ? `shadow-lg ${e.glow}` : ""}
                      `}
                      style={{
                        height: done ? `${Math.max(prob * 100, 8)}%` : "100%",
                        animationDelay: `${i * 0.12}s`,
                      }}
                    />
                  );
                })}
              </div>

              {!done && (
                <div className="text-center">
                  {file ? (
                    <p className="font-mono text-sm text-slate-300 truncate max-w-xs">
                      {file.name}
                    </p>
                  ) : (
                    <>
                      <p className="text-slate-200 font-medium flex items-center gap-2 justify-center">
                        <UploadCloud className="w-4 h-4 text-amber-400" />
                        Drop an audio file, or click to browse
                      </p>
                      <p className="text-xs text-slate-500 mt-1">WAV, MP3, FLAC, OGG, or M4A</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error message */}
          {status === STATUS.ERROR && (
            <div className="float-in mt-4 flex items-start gap-2 rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-300">{errorMsg}</p>
            </div>
          )}

          {/* Result */}
          {done && (
            <div className="float-in mt-6 text-center">
              <p className="font-mono text-xs tracking-[0.25em] text-slate-500 uppercase mb-1">
                Detected emotion
              </p>
              <p className="text-3xl font-black tracking-tight text-slate-50">
                {result.emotion}
              </p>
              <p className="font-mono text-sm text-amber-400 mt-1">
                {(result.confidence * 100).toFixed(1)}% confidence
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {EMOTIONS.map((e) => (
                  <div key={e.key} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${e.color}`} />
                    <span className="text-xs text-slate-400">{e.key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {!done ? (
              <button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className={`group relative inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-medium text-sm
                  transition-all duration-300 ease-out
                  ${!file || analyzing
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-amber-400 text-slate-950 hover:bg-amber-300 hover:shadow-lg hover:shadow-amber-400/25 hover:-translate-y-0.5 active:translate-y-0"}
                `}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <AudioWaveform className="w-4 h-4" />
                    Analyze voice
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-medium text-sm
                  bg-slate-800 text-slate-200 hover:bg-slate-700 hover:-translate-y-0.5 active:translate-y-0
                  transition-all duration-300 ease-out"
              >
                <RotateCcw className="w-4 h-4" />
                Try another clip
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}