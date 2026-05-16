"use client";

import { useState, useRef } from "react";

const PRESETS = [
  { label: "🎮 RPG 史诗战斗", prompt: "Epic orchestral battle theme for RPG game, dramatic strings, brass fanfare, timpani, 140 BPM, D minor. Instrumental only." },
  { label: "🌙 Lo-Fi 放松", prompt: "Lo-fi hip hop chill beat, warm piano chords, vinyl crackle, soft drums, relaxing, 85 BPM. Instrumental only." },
  { label: "⚡ EDM Drop", prompt: "Energetic EDM track with massive synth drop, driving bass, electronic drums, 128 BPM. Instrumental only." },
  { label: "🎬 电影配乐", prompt: "Cinematic orchestral score, emotional strings, gentle piano, building to a powerful climax. Instrumental only." },
  { label: "🎸 摇滚吉他", prompt: "Rock guitar riff, distorted electric guitar, powerful drums, bass groove, 120 BPM. Instrumental only." },
  { label: "🌸 日系动漫", prompt: "Japanese anime opening theme, upbeat pop rock, bright synths, catchy melody, 160 BPM." },
];

interface Track {
  name: string;
  audio: string;
  mimeType: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"clip" | "pro">("clip");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [lyrics, setLyrics] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setTracks([]);
    setLyrics("");
    setAnalysis("");

    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("mode", mode);
      if (audioFile) {
        formData.append("audio", audioFile);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      // 处理非 JSON 响应（比如 413 Request Entity Too Large）
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        setError(res.status === 413 ? "文件太大，请上传小于 4MB 的音频" : `服务器错误 (${res.status}): ${text.slice(0, 100)}`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "生成失败");
        return;
      }

      setTracks(data.tracks || []);
      setLyrics(data.lyrics || "");
      setAnalysis(data.analysis || "");
    } catch (e: any) {
      setError(e.message || "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Vercel 限制 4.5MB，留点余量
      if (file.size > 4 * 1024 * 1024) {
        setError("音频文件不能超过 4MB，请压缩后重试");
        return;
      }
      setError("");
      setAudioFile(file);
      setAudioFileName(file.name);
    }
  }

  function clearFile() {
    setAudioFile(null);
    setAudioFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.logo}>HookCraft</h1>
          <p style={styles.subtitle}>AI Music Generation Demo</p>
          <p style={styles.badge}>Powered by Google Lyria 3</p>
        </div>

        {/* 参考音频上传 */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>📎 参考音频（可选）：</p>
          <div style={styles.uploadArea}>
            {audioFileName ? (
              <div style={styles.fileInfo}>
                <span>🎵 {audioFileName}</span>
                <button onClick={clearFile} style={styles.clearBtn}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} style={styles.uploadBtn}>
                点击上传参考音乐（MP3/WAV）
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </div>
          {audioFileName && (
            <p style={styles.hint}>AI 将分析这段音乐的风格，基于它生成新的音乐</p>
          )}
        </div>

        {/* 模型选择 */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>🎛️ 生成模式：</p>
          <div style={styles.modeToggle}>
            <button
              onClick={() => setMode("clip")}
              style={{ ...styles.modeBtn, ...(mode === "clip" ? styles.modeBtnActive : {}) }}
            >
              🎵 Clip（30秒）
            </button>
            <button
              onClick={() => setMode("pro")}
              style={{ ...styles.modeBtn, ...(mode === "pro" ? styles.modeBtnActive : {}) }}
            >
              🎶 Pro（完整歌曲）
            </button>
          </div>
        </div>

        {/* 预设风格 */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>⚡ 快速选择风格：</p>
          <div style={styles.presetGrid}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                style={{ ...styles.presetBtn, ...(prompt === p.prompt ? styles.presetBtnActive : {}) }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 描述输入 */}
        <div style={styles.section}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={audioFileName
              ? "描述你想要的变化，例如：保持这个风格但改变配器，加入更多弦乐..."
              : "描述你想要的音乐风格，例如：一首适合 RPG 游戏的史诗管弦乐，140 BPM，D 小调..."}
            style={styles.textarea}
            rows={3}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{ ...styles.generateBtn, ...(loading || !prompt.trim() ? styles.generateBtnDisabled : {}) }}
          >
            {loading ? "🎵 生成中..." : audioFileName ? "✨ 基于参考音乐生成" : "✨ 生成音乐"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={styles.loadingBox}>
            <div style={styles.waveContainer}>
              {[...Array(12)].map((_, i) => (
                <div key={i} style={{ ...styles.waveBar, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <p style={styles.loadingText}>
              {mode === "pro" ? "AI 正在创作完整歌曲，大约需要 1-2 分钟..." : "AI 正在创作中，大约需要 30-60 秒..."}
            </p>
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.errorBox}>❌ {error}</div>}

        {/* 音频分析结果 */}
        {analysis && (
          <div style={styles.lyricsBox}>
            <p style={styles.sectionLabel}>🔍 参考音频分析：</p>
            <pre style={styles.lyricsText}>{analysis}</pre>
          </div>
        )}

        {/* 歌词 */}
        {lyrics && (
          <div style={styles.lyricsBox}>
            <p style={styles.sectionLabel}>📝 歌词 / 结构：</p>
            <pre style={styles.lyricsText}>{lyrics}</pre>
          </div>
        )}

        {/* 音轨播放器 */}
        {tracks.length > 0 && (
          <div style={styles.tracksBox}>
            <p style={styles.tracksTitle}>🎶 生成完成 — {tracks.length} 个音轨</p>
            {tracks.map((track, i) => (
              <div key={i} style={styles.trackItem}>
                <div style={styles.trackHeader}>
                  <span style={styles.trackName}>{track.name}</span>
                  <a
                    href={`data:${track.mimeType};base64,${track.audio}`}
                    download={`hookcraft-${track.name}-${Date.now()}.mp3`}
                    style={styles.downloadBtn}
                  >
                    📥 下载
                  </a>
                </div>
                <audio
                  controls
                  autoPlay={i === 0}
                  src={`data:${track.mimeType};base64,${track.audio}`}
                  style={styles.audio}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "linear-gradient(135deg, #0d0d14 0%, rgba(117, 54, 213, 0.15) 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
  card: { background: "#1a1a2e", borderRadius: "24px", padding: "36px", maxWidth: "680px", width: "100%", boxShadow: "0 8px 40px rgba(117, 54, 213,0.15)" },
  header: { textAlign: "center" as const, marginBottom: "28px" },
  logo: { fontSize: "36px", fontWeight: 700, color: "#7536d5", fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", margin: "0 0 6px" },
  subtitle: { fontSize: "15px", color: "#9ca3af", margin: "0 0 8px" },
  badge: { display: "inline-block", fontSize: "12px", color: "#999", background: "#F8F5F0", padding: "4px 12px", borderRadius: "12px" },
  section: { marginBottom: "20px" },
  sectionLabel: { fontSize: "13px", color: "#999", marginBottom: "8px", fontWeight: 500 },
  uploadArea: { border: "2px dashed #2a2a40", borderRadius: "14px", padding: "16px", textAlign: "center" as const },
  uploadBtn: { background: "none", border: "none", color: "#7536d5", fontSize: "14px", cursor: "pointer", fontWeight: 500, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  fileInfo: { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontSize: "14px", color: "#e8e8f0" },
  clearBtn: { background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "16px" },
  hint: { fontSize: "12px", color: "#7536d5", marginTop: "6px", textAlign: "center" as const },
  modeToggle: { display: "flex", gap: "8px" },
  modeBtn: { flex: 1, padding: "10px", borderRadius: "12px", border: "1.5px solid #2a2a40", background: "#1a1a2e", fontSize: "13px", cursor: "pointer", fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", fontWeight: 500, color: "#9ca3af", transition: "all 0.2s" },
  modeBtnActive: { borderColor: "#7536d5", background: "rgba(117, 54, 213, 0.1)", color: "#7536d5", fontWeight: 600 },
  presetGrid: { display: "flex", flexWrap: "wrap" as const, gap: "8px" },
  presetBtn: { padding: "7px 14px", borderRadius: "18px", border: "1.5px solid #2a2a40", background: "#1a1a2e", fontSize: "13px", cursor: "pointer", color: "#e8e8f0", transition: "all 0.2s" },
  presetBtnActive: { borderColor: "#7536d5", background: "rgba(117, 54, 213, 0.1)", color: "#7536d5", fontWeight: 600 },
  textarea: { width: "100%", padding: "14px 16px", borderRadius: "14px", border: "1.5px solid #2a2a40", fontSize: "14px", fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", resize: "vertical" as const, marginBottom: "12px", outline: "none", boxSizing: "border-box" as const },
  generateBtn: { width: "100%", padding: "14px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #7536d5, #5a2db8)", color: "white", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  generateBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  loadingBox: { textAlign: "center" as const, padding: "28px 0" },
  waveContainer: { display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "4px", height: "50px", marginBottom: "14px" },
  waveBar: { width: "5px", height: "100%", background: "linear-gradient(180deg, #7536d5, #5a2db8)", borderRadius: "3px", animation: "wave 1.2s ease-in-out infinite" },
  loadingText: { fontSize: "13px", color: "#999" },
  errorBox: { background: "rgba(229, 57, 53, 0.1)", border: "1px solid rgba(229, 57, 53, 0.3)", borderRadius: "12px", padding: "14px 16px", color: "#E53935", fontSize: "13px", marginBottom: "16px", whiteSpace: "pre-wrap" as const },
  lyricsBox: { background: "#FAFAF8", borderRadius: "14px", padding: "16px", marginBottom: "16px" },
  lyricsText: { fontSize: "13px", color: "#e8e8f0", lineHeight: 1.7, whiteSpace: "pre-wrap" as const, margin: 0, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  tracksBox: { background: "#FAFAF8", borderRadius: "16px", padding: "20px" },
  tracksTitle: { fontSize: "16px", fontWeight: 600, color: "#e8e8f0", marginBottom: "16px", textAlign: "center" as const },
  trackItem: { background: "#1a1a2e", borderRadius: "12px", padding: "14px", marginBottom: "10px", border: "1px solid #f0f0f0" },
  trackHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" },
  trackName: { fontSize: "14px", fontWeight: 600, color: "#e8e8f0" },
  downloadBtn: { padding: "6px 14px", borderRadius: "10px", background: "linear-gradient(135deg, #7536d5, #5a2db8)", color: "white", textDecoration: "none", fontSize: "12px", fontWeight: 600 },
  audio: { width: "100%", height: "36px" },
};
