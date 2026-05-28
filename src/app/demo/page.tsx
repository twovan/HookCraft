"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";

const PRESETS = [
  {
    label: "RPG 史诗战斗",
    prompt: "Epic orchestral battle theme for RPG game, dramatic strings, brass fanfare, timpani, 140 BPM, D minor. Instrumental only.",
  },
  {
    label: "Lo-Fi 放松",
    prompt: "Lo-fi hip hop chill beat, warm piano chords, vinyl crackle, soft drums, relaxing, 85 BPM. Instrumental only.",
  },
  {
    label: "EDM Drop",
    prompt: "Energetic EDM track with massive synth drop, driving bass, electronic drums, 128 BPM. Instrumental only.",
  },
  {
    label: "电影配乐",
    prompt: "Cinematic orchestral score, emotional strings, gentle piano, building to a powerful climax. Instrumental only.",
  },
  {
    label: "摇滚吉他",
    prompt: "Rock guitar riff, distorted electric guitar, powerful drums, bass groove, 120 BPM. Instrumental only.",
  },
  {
    label: "日系动画",
    prompt: "Japanese anime opening theme, upbeat pop rock, bright synths, catchy melody, 160 BPM.",
  },
];

interface Track {
  name: string;
  audio: string;
  mimeType: string;
}

export default function DemoPage() {
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
      if (audioFile) formData.append("audio", audioFile);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        setError(res.status === 413 ? "文件过大，请上传小于 4MB 的音频。" : `服务端错误 (${res.status})：${text.slice(0, 100)}`);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成失败，请稍后重试。");
        return;
      }

      setTracks(data.tracks || []);
      setLyrics(data.lyrics || "");
      setAnalysis(data.analysis || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误，请重试。");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setError("音频文件不能超过 4MB，请压缩后重试。");
      return;
    }

    setError("");
    setAudioFile(file);
    setAudioFileName(file.name);
  }

  function clearFile() {
    setAudioFile(null);
    setAudioFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <span style={styles.kicker}>HookCraft Demo</span>
            <h1 style={styles.title}>快速生成音乐片段</h1>
            <p style={styles.subtitle}>用自然语言描述风格，或上传参考音频，让系统生成可试听的 demo 版本。</p>
          </div>
          <div style={styles.statusCard}>
            <span>MODE</span>
            <strong>{mode === "pro" ? "完整歌曲" : "短片段"}</strong>
          </div>
        </header>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <FieldTitle title="参考音频" description="可选。上传 MP3/WAV 后，系统会尝试分析参考音频风格。" />
            <div style={styles.uploadArea}>
              {audioFileName ? (
                <div style={styles.fileInfo}>
                  <span>{audioFileName}</span>
                  <button type="button" onClick={clearFile} style={styles.clearButton}>
                    移除
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.uploadButton}>
                  选择参考音频
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

            <FieldTitle title="生成模式" />
            <div style={styles.modeToggle}>
              <ModeButton active={mode === "clip"} onClick={() => setMode("clip")} title="Clip" detail="约 30 秒" />
              <ModeButton active={mode === "pro"} onClick={() => setMode("pro")} title="Pro" detail="完整歌曲" />
            </div>

            <FieldTitle title="快速预设" />
            <div style={styles.presetGrid}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPrompt(preset.prompt)}
                  style={preset.prompt === prompt ? { ...styles.presetButton, ...styles.presetButtonActive } : styles.presetButton}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section style={styles.panel}>
            <FieldTitle title="音乐描述" description="写清风格、情绪、速度、乐器和使用场景，结果会更稳定。" />
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                audioFileName
                  ? "例如：保留参考音频的氛围，但改成更适合夜间聆听的电子流行版本，鼓组更克制。"
                  : "例如：一首适合 RPG 游戏战斗场景的史诗管弦乐，140 BPM，D 小调，铜管和定音鼓更突出。"
              }
              style={styles.textarea}
              rows={5}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              style={loading || !prompt.trim() ? { ...styles.generateButton, ...styles.generateButtonDisabled } : styles.generateButton}
            >
              {loading ? "生成中..." : audioFileName ? "基于参考音频生成" : "生成音乐"}
            </button>
          </section>
        </div>

        {loading && (
          <section style={styles.loadingPanel}>
            <div style={styles.waveContainer}>
              {Array.from({ length: 14 }).map((_, index) => (
                <span key={index} style={{ ...styles.waveBar, animationDelay: `${index * 0.08}s` }} />
              ))}
            </div>
            <p style={styles.mutedText}>
              {mode === "pro" ? "正在生成完整歌曲，通常需要 1-2 分钟。" : "正在生成短片段，通常需要 30-60 秒。"}
            </p>
          </section>
        )}

        {error && <section style={styles.errorBox}>{error}</section>}

        {analysis && <TextResult title="参考音频分析" content={analysis} />}
        {lyrics && <TextResult title="歌词 / 结构" content={lyrics} />}

        {tracks.length > 0 && (
          <section style={styles.resultsPanel}>
            <div style={styles.resultsHeader}>
              <h2>生成完成</h2>
              <span>{tracks.length} 个音轨</span>
            </div>
            {tracks.map((track, index) => (
              <article key={`${track.name}-${index}`} style={styles.trackItem}>
                <div style={styles.trackHeader}>
                  <strong>{track.name || `Track ${index + 1}`}</strong>
                  <a
                    href={`data:${track.mimeType};base64,${track.audio}`}
                    download={`hookcraft-${track.name || index + 1}-${Date.now()}.mp3`}
                    style={styles.downloadButton}
                  >
                    下载
                  </a>
                </div>
                <audio controls autoPlay={index === 0} src={`data:${track.mimeType};base64,${track.audio}`} style={styles.audio} />
              </article>
            ))}
          </section>
        )}
      </section>

      <style>{`
        @keyframes demo-wave {
          0%, 100% { transform: scaleY(.32); opacity: .45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </main>
  );
}

function FieldTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div style={styles.fieldTitle}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button type="button" onClick={onClick} style={active ? { ...styles.modeButton, ...styles.modeButtonActive } : styles.modeButton}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

function TextResult({ title, content }: { title: string; content: string }) {
  return (
    <section style={styles.textResult}>
      <h2>{title}</h2>
      <pre>{content}</pre>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 12% 12%, rgba(208,255,90,.10), transparent 300px), radial-gradient(circle at 88% 18%, rgba(115,247,215,.08), transparent 340px), var(--hc-bg)",
    color: "var(--hc-text)",
    padding: "42px 22px 72px",
  },
  shell: {
    maxWidth: 1040,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 20,
    marginBottom: 24,
  },
  kicker: {
    color: "var(--hc-lime)",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: ".1em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0",
    fontSize: "clamp(40px, 6vw, 72px)",
    lineHeight: 1,
  },
  subtitle: {
    margin: 0,
    color: "var(--hc-muted)",
    fontSize: 15,
    lineHeight: 1.7,
    maxWidth: 620,
  },
  statusCard: {
    minWidth: 128,
    border: "1px solid var(--hc-line)",
    borderRadius: "var(--hc-radius)",
    background: "rgba(24,26,34,.86)",
    padding: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, .86fr) minmax(0, 1.14fr)",
    gap: 18,
  },
  panel: {
    border: "1px solid var(--hc-line)",
    borderRadius: "var(--hc-radius-lg)",
    background: "rgba(24,26,34,.88)",
    boxShadow: "var(--hc-shadow)",
    padding: 24,
  },
  fieldTitle: {
    margin: "0 0 12px",
  },
  uploadArea: {
    border: "1px dashed rgba(208,255,90,.34)",
    borderRadius: "var(--hc-radius)",
    background: "rgba(208,255,90,.06)",
    padding: 18,
    marginBottom: 22,
    textAlign: "center",
  },
  uploadButton: {
    border: "none",
    background: "transparent",
    color: "var(--hc-lime)",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    color: "var(--hc-text)",
    fontSize: 13,
  },
  clearButton: {
    border: "1px solid var(--hc-line)",
    borderRadius: 999,
    background: "rgba(255,255,255,.04)",
    color: "var(--hc-muted)",
    padding: "7px 10px",
    cursor: "pointer",
  },
  modeToggle: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 22,
  },
  modeButton: {
    minHeight: 58,
    border: "1px solid var(--hc-line)",
    borderRadius: 14,
    background: "rgba(255,255,255,.04)",
    color: "var(--hc-text)",
    cursor: "pointer",
  },
  modeButtonActive: {
    borderColor: "rgba(208,255,90,.58)",
    background: "rgba(208,255,90,.12)",
    color: "var(--hc-lime)",
  },
  presetGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  presetButton: {
    border: "1px solid var(--hc-line)",
    borderRadius: 999,
    background: "rgba(255,255,255,.04)",
    color: "var(--hc-text)",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  presetButtonActive: {
    borderColor: "rgba(208,255,90,.58)",
    background: "rgba(208,255,90,.12)",
    color: "var(--hc-lime)",
  },
  textarea: {
    width: "100%",
    minHeight: 156,
    border: "1px solid var(--hc-line)",
    borderRadius: 14,
    background: "#0d0f14",
    color: "var(--hc-text)",
    padding: "14px 16px",
    fontSize: 14,
    lineHeight: 1.7,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 14,
  },
  generateButton: {
    width: "100%",
    minHeight: 52,
    border: "1px solid rgba(208,255,90,.9)",
    borderRadius: 999,
    background: "linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))",
    color: "#08090c",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
  },
  generateButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  loadingPanel: {
    marginTop: 18,
    border: "1px solid var(--hc-line)",
    borderRadius: "var(--hc-radius-lg)",
    background: "rgba(24,26,34,.88)",
    padding: "28px 20px",
    textAlign: "center",
  },
  waveContainer: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 5,
    height: 54,
    marginBottom: 12,
  },
  waveBar: {
    width: 6,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(180deg, var(--hc-lime), var(--hc-cyan))",
    animation: "demo-wave 1.1s ease-in-out infinite",
    transformOrigin: "bottom",
  },
  mutedText: {
    margin: 0,
    color: "var(--hc-muted)",
    fontSize: 13,
  },
  errorBox: {
    marginTop: 18,
    border: "1px solid rgba(255,90,61,.34)",
    borderRadius: 14,
    background: "rgba(255,90,61,.1)",
    color: "#ff8b76",
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  },
  textResult: {
    marginTop: 18,
    border: "1px solid var(--hc-line)",
    borderRadius: "var(--hc-radius-lg)",
    background: "rgba(24,26,34,.88)",
    padding: 20,
  },
  resultsPanel: {
    marginTop: 18,
    border: "1px solid var(--hc-line)",
    borderRadius: "var(--hc-radius-lg)",
    background: "rgba(24,26,34,.88)",
    padding: 20,
  },
  resultsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  trackItem: {
    border: "1px solid var(--hc-line)",
    borderRadius: 14,
    background: "rgba(8,9,12,.44)",
    padding: 14,
    marginBottom: 10,
  },
  trackHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  downloadButton: {
    border: "1px solid rgba(208,255,90,.34)",
    borderRadius: 999,
    background: "rgba(208,255,90,.1)",
    color: "var(--hc-lime)",
    textDecoration: "none",
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 900,
  },
  audio: {
    width: "100%",
    height: 36,
  },
};
