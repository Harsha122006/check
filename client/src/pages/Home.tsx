/*
 * FitCheck style reminder: light-table editorial system; the frame is the hero.
 * Use cool paper, ink, mono edge codes, crop marks, and grease-pencil red sparingly.
 */
import { useEffect, useRef, useState } from "react";
import type { DragEvent, RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileImage,
  FolderOpen,
  History as HistoryIcon,
  ImagePlus,
  MoreHorizontal,
  RefreshCw,
  ScanLine,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

type Stage = "home" | "preview" | "analyzing" | "results" | "history";

type Category = {
  label: string;
  key: string;
  score: number;
  note: string;
};

const HERO_IMAGE = "/manus-storage/fitcheck-hero_ef1eb9dc.jpg";
const FRAME_TWO = "/manus-storage/fitcheck-frame-02_3a69fa34.jpg";
const FRAME_THREE = "/manus-storage/fitcheck-frame-03_bdf116c6.jpg";
const MARK_IMAGE = "/manus-storage/fitcheck-mark_9e62fd59.png";

const categories: Category[] = [
  { label: "Color coordination", key: "COLOR / 01", score: 9.1, note: "olive + cream balance" },
  { label: "Fit & silhouette", key: "SHAPE / 02", score: 8.9, note: "clean straight line" },
  { label: "Styling", key: "DETAIL / 03", score: 8.3, note: "tote adds intention" },
  { label: "Occasion match", key: "CONTEXT / 04", score: 8.5, note: "campus to dinner" },
  { label: "Trend awareness", key: "SIGNAL / 05", score: 8.7, note: "quietly current" },
];

const historyItems = [
  { id: "014", date: "AUG 26", score: "8.7", vibe: "clean utility", image: HERO_IMAGE },
  { id: "013", date: "AUG 22", score: "7.9", vibe: "soft tailoring", image: FRAME_TWO },
  { id: "012", date: "AUG 19", score: "8.4", vibe: "after-class", image: FRAME_THREE },
  { id: "011", date: "AUG 15", score: "7.6", vibe: "weekend uniform", image: FRAME_TWO },
];

const analysisMessages = [
  "Finding the silhouette…",
  "Reading color relationships…",
  "Checking the occasion signal…",
  "Pulling the useful notes…",
];

function FitMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`fit-mark ${compact ? "fit-mark--compact" : ""}`} aria-label="FitCheck">
      <img src={MARK_IMAGE} alt="" />
      {!compact && <span className="fit-wordmark">FITCHECK</span>}
    </span>
  );
}

function CropMarks() {
  return (
    <>
      <span className="crop-mark crop-mark--tl" />
      <span className="crop-mark crop-mark--tr" />
      <span className="crop-mark crop-mark--bl" />
      <span className="crop-mark crop-mark--br" />
    </>
  );
}

function RatingReveal({ score }: { score: number }) {
  const bubbles = [
    { label: "COLOR", value: "9.1", className: "rating-bubble--one" },
    { label: "SHAPE", value: "8.9", className: "rating-bubble--two" },
    { label: "DETAIL", value: "8.3", className: "rating-bubble--three" },
  ];

  return (
    <div className="rating-hero">
      <div className="rating-orbit">
        <motion.div
          className="rating-ring"
          initial={{ scale: 0.86, opacity: 0, rotate: -16 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.05 }}
        >
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle className="rating-ring-track" cx="80" cy="80" r="68" pathLength="1" />
            <motion.circle className="rating-ring-progress" cx="80" cy="80" r="68" pathLength="1" initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 1 - score / 10 }} transition={{ duration: 0.9, ease: "easeOut", delay: 0.18 }} />
          </svg>
          <div className="rating-center"><span className="rating-number">{score.toFixed(1)}</span><span className="mono rating-denom">OUT OF 10</span></div>
        </motion.div>
        {bubbles.map((bubble, index) => (
          <motion.div
            key={bubble.label}
            className={`rating-bubble ${bubble.className}`}
            initial={{ opacity: 0, scale: 0.78, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
            transition={{ opacity: { delay: 0.3 + index * 0.08, duration: 0.2 }, scale: { delay: 0.3 + index * 0.08, type: "spring", stiffness: 160, damping: 13 }, y: { delay: 0.72 + index * 0.12, duration: 2.8, repeat: Infinity, ease: "easeInOut" } }}
          >
            <span className="mono">{bubble.label}</span><strong>{bubble.value}</strong>
          </motion.div>
        ))}
      </div>
      <div className="rating-copy"><span className="mono score-kicker">OVERALL FIT SCORE</span><p>A considered combination with room to sharpen.</p><span className="rating-caption">Your strongest signals are color and silhouette.</span></div>
    </div>
  );
}

function HomeView({
  onDevelop,
  onSample,
  onHistory,
}: {
  onDevelop: () => void;
  onSample: () => void;
  onHistory: () => void;
}) {
  return (
    <section className="home-view">
      <div className="home-copy">
        <div className="eyebrow-row">
          <span className="red-dot" />
          <span>YOUR PERSONAL FIT EDITOR</span>
        </div>
        <h1>
          Know the fit
          <br />
          <em>before you go.</em>
        </h1>
        <p className="home-intro">
          Upload the outfit. Get the useful read. Leave the house with one less question in your head.
        </p>
        <div className="home-actions">
          <button className="btn btn--red" onClick={onDevelop}>
            Develop My Fit <ArrowUpRight size={17} strokeWidth={2.4} />
          </button>
          <button className="text-button" onClick={onSample}>
            <span className="button-under">Try a sample frame</span>
            <ChevronRight size={15} />
          </button>
        </div>
        <p className="privacy-note">
          <Sparkles size={13} /> Photos are analyzed by AI and stored on this device.
        </p>
      </div>

      <div className="hero-workbench">
        <div className="workbench-index">
          <span className="mono">CONTACT SHEET / 01</span>
          <span className="index-line" />
          <span className="mono">SELECTED FRAME</span>
        </div>
        <div className="hero-frame-wrap">
          <div className="hero-frame">
            <CropMarks />
            <img src={HERO_IMAGE} alt="A full outfit in a mirror, ready for a FitCheck" />
            <div className="frame-grain" />
            <span className="frame-registration">●</span>
          </div>
          <div className="frame-caption">
            <div>
              <span className="mono">FIT Nº 014 · AUG 26</span>
              <span className="caption-title">LAST LOOK / 18:42</span>
            </div>
            <div className="caption-score">
              <span className="mono">PREVIEW</span>
              <span className="score-mini">—</span>
            </div>
          </div>
        </div>
        <div className="hero-side-note">
          <span className="side-note-label">THE PROMISE</span>
          <span className="side-note-line" />
          <p>Specific notes for the clothes you actually put on.</p>
        </div>
        <button className="floating-history" onClick={onHistory}>
          <HistoryIcon size={16} />
          <span>14 developed fits</span>
          <ArrowUpRight size={15} />
        </button>
      </div>
    </section>
  );
}

function PreviewView({
  photo,
  fileName,
  dragActive,
  onChoose,
  onFile,
  onDrop,
  onDevelop,
  onRetake,
  inputRef,
  setDragActive,
}: {
  photo: string | null;
  fileName: string;
  dragActive: boolean;
  onChoose: () => void;
  onFile: (file: File) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDevelop: () => void;
  onRetake: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  setDragActive: (value: boolean) => void;
}) {
  return (
    <section className="flow-view preview-view">
      <div className="flow-heading">
        <div>
          <span className="mono step-label">01 / CAPTURE</span>
          <h1>Put the frame<br /><em>on the light table.</em></h1>
        </div>
        <p className="flow-caption">Full-body shots score most accurately.<br />Portrait or landscape both work.</p>
      </div>

      <div
        className={`upload-stage ${dragActive ? "is-dragging" : ""} ${photo ? "has-photo" : ""}`}
        onDrop={onDrop}
        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
      >
        {photo ? (
          <div className="preview-frame">
            <CropMarks />
            <img src={photo} alt="Outfit preview" />
            <div className="preview-label mono">{fileName || "FRAME 014"}</div>
            <button className="retake-button" onClick={onRetake}>
              <RefreshCw size={14} /> Retake
            </button>
          </div>
        ) : (
          <button className="drop-target" onClick={onChoose}>
            <div className="drop-icon"><ImagePlus size={27} strokeWidth={1.6} /></div>
            <span className="drop-title">Drop your outfit here</span>
            <span className="drop-subtitle">or choose from your camera roll</span>
            <span className="drop-hint mono"><Camera size={13} /> CAMERA READY</span>
          </button>
        )}
      </div>

      <div className="flow-footer">
        <div className="flow-footnote">
          <span className="red-dot" />
          <span>One photo. One honest read.</span>
        </div>
        <div className="flow-actions">
          <button className="btn btn--quiet" onClick={onChoose}>
            <FolderOpen size={16} /> Choose another
          </button>
          <button className="btn btn--red" onClick={onDevelop} disabled={!photo}>
            Develop this fit <ArrowUpRight size={17} />
          </button>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
      }} />
    </section>
  );
}

function AnalyzingView({ photo, messageIndex }: { photo: string; messageIndex: number }) {
  return (
    <section className="analyzing-view">
      <div className="analysis-frame-wrap">
        <div className="analysis-frame">
          <img src={photo} alt="Outfit being analyzed" />
          <div className="analysis-tint" />
          <motion.div className="scan-line" animate={{ top: ["18%", "82%", "18%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
          <CropMarks />
          <div className="analysis-overlay mono"><ScanLine size={14} /> LIVE READ / 014</div>
        </div>
      </div>
      <div className="analysis-copy">
        <span className="mono step-label">02 / DEVELOPING</span>
        <h1>Looking<br /><em>closer.</em></h1>
        <p>{analysisMessages[messageIndex]}</p>
        <div className="analysis-progress"><motion.span animate={{ width: `${Math.min(94, 24 + messageIndex * 24)}%` }} transition={{ type: "spring", stiffness: 90, damping: 18 }} /></div>
        <span className="mono analysis-foot">AI STYLIST / SONNET TIER / {String(messageIndex + 1).padStart(2, "0")} OF 04</span>
      </div>
    </section>
  );
}

function ResultsView({
  photo,
  score,
  saved,
  onSave,
  onShare,
  onAgain,
}: {
  photo: string;
  score: number;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onAgain: () => void;
}) {
  return (
    <section className="results-view">
      <div className="results-topline">
        <div>
          <span className="mono step-label">03 / DEVELOPED FRAME</span>
          <h1>Your fit, <em>developed.</em></h1>
        </div>
        <div className="results-top-meta mono">FIT Nº 014 · AUG 26 <span className="status-pill"><span /> SAVED LOCALLY</span></div>
      </div>

      <div className="results-layout">
        <div className="result-photo-column">
          <div className="result-frame">
            <CropMarks />
            <img src={photo} alt="Your developed outfit frame" />
            <div className="frame-grain" />
            <span className="result-frame-id mono">FC / 014</span>
          </div>
          <div className="photo-caption">
            <span className="mono">FULL OUTFIT / MIRROR CAPTURE</span>
            <span className="mono">18:42:16</span>
          </div>
        </div>

        <div className="results-notes">
          <RatingReveal score={score} />

          <div className="vibe-line"><span className="mono">VIBE TAG</span><span className="vibe-tag">clean utility</span></div>

          <div className="category-list">
            {categories.map((category, index) => (
              <motion.div
                key={category.key}
                className="category-row"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.14 + index * 0.08, type: "spring", stiffness: 120, damping: 18 }}
              >
                <div className="category-heading">
                  <span>{category.label}</span>
                  <span className="mono category-score">{category.score.toFixed(1)}</span>
                </div>
                <div className="category-bar"><span className={category.score > 8.8 ? "is-green" : ""} style={{ width: `${category.score * 10}%` }} /></div>
                <span className="mono category-note">{category.key} · {category.note}</span>
              </motion.div>
            ))}
          </div>

          <div className="verdict-block">
            <span className="mono verdict-kicker">THE READ</span>
            <h2>Good structure. Let the shirt breathe.</h2>
            <p>The charcoal overshirt gives the olive trousers a clean vertical line. The cream sneakers keep the contrast easy without flattening the look.</p>
          </div>

          <div className="tips-block">
            <span className="mono verdict-kicker">TWO SMALL MOVES</span>
            <div className="tip"><span className="tip-number">01</span><p>Push the sleeves once to show a sliver of the tee and break up the layers.</p></div>
            <div className="tip"><span className="tip-number">02</span><p>Keep the tote low and loose; it will echo the trouser line instead of competing with it.</p></div>
          </div>

          <div className="result-actions">
            <button className={`btn btn--red ${saved ? "is-saved" : ""}`} onClick={onSave}>
              {saved ? <Check size={16} /> : <Bookmark size={16} />} {saved ? "Saved to history" : "Save this fit"}
            </button>
            <button className="btn btn--quiet" onClick={onShare}><Share2 size={16} /> Share card</button>
            <button className="icon-button" onClick={onAgain} aria-label="Develop another fit"><RefreshCw size={17} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HistoryView({ onBack, onDevelop }: { onBack: () => void; onDevelop: () => void }) {
  return (
    <section className="history-view">
      <div className="history-heading">
        <div>
          <button className="back-button" onClick={onBack}><ArrowLeft size={15} /> Back to workbench</button>
          <span className="mono step-label">ARCHIVE / 14 FRAMES</span>
          <h1>The fits<br /><em>you kept.</em></h1>
        </div>
        <div className="streak-card">
          <span className="mono">CURRENT STREAK</span>
          <strong>04</strong>
          <span className="streak-copy">four looks developed<br />this week</span>
        </div>
      </div>

      <div className="history-summary">
        <div className="summary-copy"><span className="mono">SCORE OVER TIME</span><p>Small changes. A sharper average.</p></div>
        <div className="chart-wrap">
          <svg className="score-chart" viewBox="0 0 640 150" preserveAspectRatio="none" role="img" aria-label="Fit score over the last four developed looks">
            <path className="chart-grid" d="M0 22H640M0 74H640M0 126H640" />
            <path className="chart-line" d="M8 98 C86 88 126 92 182 66 S286 72 342 52 S456 72 512 42 S580 48 632 26" />
            <path className="chart-fill" d="M8 98 C86 88 126 92 182 66 S286 72 342 52 S456 72 512 42 S580 48 632 26 L632 150 L8 150Z" />
            <circle className="chart-dot" cx="632" cy="26" r="5" />
          </svg>
          <div className="chart-labels mono"><span>AUG 15</span><span>AUG 19</span><span>AUG 22</span><span>AUG 26</span></div>
        </div>
        <div className="average-score"><span className="mono">AVG. SCORE</span><strong>8.2</strong><span className="delta">+0.6 vs. first frame</span></div>
      </div>

      <div className="history-toolbar"><span className="mono">RECENTLY DEVELOPED</span><button className="text-button" onClick={onDevelop}><span className="button-under">Develop a new fit</span><ArrowUpRight size={15} /></button></div>
      <div className="history-grid">
        {historyItems.map((item, index) => (
          <motion.article className="history-frame" key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08, type: "spring", stiffness: 130, damping: 18 }}>
            <div className="history-image-wrap"><img src={item.image} alt={`${item.vibe} outfit frame`} /><span className="history-score">{item.score}</span><span className="history-frame-number mono">FC / {item.id}</span></div>
            <div className="history-frame-meta"><div><span className="mono">{item.date} · FRAME {item.id}</span><h3>{item.vibe}</h3></div><button className="more-button" aria-label={`More options for frame ${item.id}`}><MoreHorizontal size={17} /></button></div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("home");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("frame_014.jpg");
  const [dragActive, setDragActive] = useState(false);
  const [analysisIndex, setAnalysisIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  const photo = previewUrl ?? HERO_IMAGE;

  useEffect(() => {
    if (stage !== "analyzing") return;
    if (reducedMotion) {
      setStage("results");
      return;
    }
    const timer = window.setInterval(() => setAnalysisIndex((current) => (current + 1) % analysisMessages.length), 620);
    const finish = window.setTimeout(() => setStage("results"), 2900);
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, [stage, reducedMotion]);

  useEffect(() => {
    if (stage !== "results") {
      setScore(0);
      return;
    }
    if (reducedMotion) {
      setScore(8.7);
      return;
    }
    let current = 0;
    const timer = window.setInterval(() => {
      current = Math.min(8.7, current + 0.29);
      setScore(Number(current.toFixed(1)));
      if (current >= 8.7) window.clearInterval(timer);
    }, 64);
    return () => window.clearInterval(timer);
  }, [stage, reducedMotion]);

  const chooseFile = (file?: File) => {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast("That file is not an image.", { description: "Choose a JPG, PNG, or HEIC outfit frame." });
      return;
    }
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name.toUpperCase());
    setSaved(false);
    setStage("preview");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const useSample = () => {
    setPreviewUrl(HERO_IMAGE);
    setFileName("SAMPLE_FRAME_014.JPG");
    setSaved(false);
    setStage("preview");
  };

  const startOver = () => {
    setStage("home");
    setPreviewUrl(null);
    setFileName("frame_014.jpg");
    setSaved(false);
  };

  const share = async () => {
    const text = "My fit scored 8.7 on FitCheck — clean utility.";
    try {
      await navigator.clipboard?.writeText(text);
      toast("Share note copied.", { description: "The share card flow is ready for your next post." });
    } catch {
      toast("Share card ready.", { description: "Copy your score and vibe tag to share it." });
    }
  };

  return (
    <div className="fitcheck-shell">
      <header className="topbar">
        <button className="brand-button" onClick={startOver} aria-label="FitCheck home"><FitMark /></button>
        <nav className="topnav" aria-label="Primary navigation">
          <button className={stage === "home" ? "is-active" : ""} onClick={startOver}>Workbench</button>
          <button className={stage === "history" ? "is-active" : ""} onClick={() => setStage("history")}>Archive <span className="nav-count">14</span></button>
        </nav>
        <div className="topbar-tools">
          <button className="topbar-new-fit" onClick={() => setStage("preview")}><ImagePlus size={14} /> New fit</button>
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait" initial={false}>
          {stage === "home" && <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}><HomeView onDevelop={() => setStage("preview")} onSample={useSample} onHistory={() => setStage("history")} /></motion.div>}
          {stage === "preview" && <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}><PreviewView photo={previewUrl} fileName={fileName} dragActive={dragActive} onChoose={() => inputRef.current?.click()} onFile={chooseFile} onDrop={handleDrop} onDevelop={() => setStage("analyzing")} onRetake={() => { setPreviewUrl(null); setFileName("frame_014.jpg"); }} inputRef={inputRef} setDragActive={setDragActive} /></motion.div>}
          {stage === "analyzing" && <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}><AnalyzingView photo={photo} messageIndex={analysisIndex} /></motion.div>}
          {stage === "results" && <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}><ResultsView photo={photo} score={score} saved={saved} onSave={() => { setSaved(true); toast("Fit saved to your archive."); }} onShare={share} onAgain={() => setStage("preview")} /></motion.div>}
          {stage === "history" && <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}><HistoryView onBack={startOver} onDevelop={() => setStage("preview")} /></motion.div>}
        </AnimatePresence>
      </main>

      <footer className="site-footer"><span className="mono">FITCHECK / 2026</span><span className="footer-rule" /><span className="mono">CLOTHES ONLY. NEVER THE PERSON.</span><button className="footer-privacy">Privacy <ChevronRight size={13} /></button></footer>
    </div>
  );
}
