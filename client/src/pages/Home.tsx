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
import { trpc } from "@/lib/trpc";

type Stage = "home" | "preview" | "analyzing" | "results" | "history";

type Category = {
  label: string;
  key: string;
  score: number;
  note: string;
};

type FitCheckCategory = {
  score: number | null;
  visibility: "visible" | "not_visible" | "unclear";
  reason: string;
};

type FitCheckResult = {
  overall_score: number;
  scores: { outfit: FitCheckCategory; color: FitCheckCategory; fit: FitCheckCategory; shoes: FitCheckCategory; styling: FitCheckCategory };
  verdict: string;
  strengths: string[];
  improvements: string[];
  summary: string;
  confidence: number;
  image_quality: "good" | "usable" | "insufficient";
  coverage: { visible_categories: string[]; unavailable_categories: string[] };
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
  "Checking your fit…",
  "Looking at the details…",
  "Putting your score together…",
];

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxDimension = 768;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const compressed = canvas.toDataURL("image/jpeg", 0.58);
      resolve(compressed.length > 700_000 ? canvas.toDataURL("image/jpeg", 0.42) : compressed);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("IMAGE_READ_FAILED")); };
    image.src = objectUrl;
  });
}

async function urlToDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("IMAGE_READ_FAILED");
  return fileToDataUrl(new File([await response.blob()], "fitcheck-sample.jpg", { type: "image/jpeg" }));
}

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
      <div className="rating-copy"><span className="mono score-kicker">OVERALL SCORE</span><p>Strong foundation. A few easy wins.</p><span className="rating-caption">Your strongest signals are color and shape.</span></div>
    </div>
  );
}

function HomeView({
  onDevelop,
  onSample,
  onHistory,
  onGallery,
  onCamera,
}: {
  onDevelop: () => void;
  onSample: () => void;
  onHistory: () => void;
  onGallery: () => void;
  onCamera: () => void;
}) {
  return (
    <section className="home-view">
      <div className="home-copy">
        <div className="eyebrow-row">
          <span className="red-dot" />
          <span>FIT CHECK / PERSONAL STYLE READ</span>
        </div>
        <h1>
          What’s the fit
          <br />
          <em>today?</em>
        </h1>
        <p className="home-intro">
          Show us your outfit. We’ll tell you what works.
        </p>
        <div className="home-actions">
          <button className="btn btn--red" onClick={onDevelop}>
            CHECK MY FIT <ArrowUpRight size={17} strokeWidth={2.4} />
          </button>
          <button className="text-button" onClick={onSample}>
            <span className="button-under">Try a sample</span>
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="home-photo-options" aria-label="Choose how to add your outfit">
          <button onClick={onCamera}><Camera size={15} /> Take a photo</button>
          <span className="option-divider">or</span>
          <button onClick={onGallery}><FolderOpen size={15} /> Choose from gallery</button>
        </div>
      </div>

      <section className="recent-fits" aria-labelledby="recent-fits-title">
        <div className="recent-heading"><h2 id="recent-fits-title">Recent Fits</h2><button className="recent-see-all" onClick={onHistory}>See all <ArrowUpRight size={14} /></button></div>
        <div className="recent-fit-list">
          {historyItems.slice(0, 3).map((item) => (
            <button className="recent-fit-card" key={item.id} onClick={onHistory}>
              <img src={item.image} alt="" />
              <span className="recent-fit-score">{item.score}</span>
              <span className="recent-fit-info"><strong>{item.score === "8.7" ? "Great fit" : "Saved look"}</strong><small>{item.vibe} · {item.date}</small></span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>

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
  onCameraChoose,
  onFile,
  onCameraFile,
  onDrop,
  onDevelop,
  onRetake,
  inputRef,
  cameraInputRef,
  setDragActive,
  category,
  setCategory,
  analysisError,
}: {
  photo: string | null;
  fileName: string;
  dragActive: boolean;
  onChoose: () => void;
  onCameraChoose: () => void;
  onFile: (file: File) => void;
  onCameraFile: (file: File) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDevelop: () => void;
  onRetake: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  setDragActive: (value: boolean) => void;
  category: string;
  setCategory: (value: string) => void;
  analysisError: string | null;
}) {
  return (
    <section className="upload-screen">
      <header className="upload-header">
        <span className="mono step-label">01 / FIT CHECK</span>
        <h1>Check your fit</h1>
        <p>Take a photo or choose one from your gallery.</p>
      </header>

      <div
        className={`upload-card ${dragActive ? "is-dragging" : ""} ${photo ? "has-photo" : ""}`}
        onDrop={onDrop}
        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
      >
        {photo ? (
          <>
            <div className="upload-preview">
              <CropMarks />
              <img src={photo} alt="Outfit preview" />
              <span className="preview-label mono">{fileName || "FRAME 014"}</span>
            </div>
            <div className="selected-copy">
              <h2>Looking good already 👀</h2>
              <p>Tell us the vibe, or skip it and get your score.</p>
            </div>
            {analysisError && (
              <div className="analysis-error" role="alert">
                <strong>We couldn’t read that fit.</strong>
                <span>{analysisError}</span>
                <button type="button" onClick={onDevelop}>Try again</button>
              </div>
            )}
            <div className="category-picker">
              <span className="category-label">What kind of fit is this? <small>Optional</small></span>
              <div className="category-chips">
                {["Casual", "Streetwear", "College", "Formal", "Party", "Other"].map((option) => (
                  <button key={option} className={category === option ? "category-chip is-selected" : "category-chip"} onClick={() => setCategory(category === option ? "" : option)}>{option}</button>
                ))}
              </div>
            </div>
            <div className="upload-submit-row">
              <button className="change-photo" onClick={onRetake}><RefreshCw size={14} /> Change photo</button>
              <button className="btn btn--red upload-submit" onClick={onDevelop}>GET MY FIT SCORE <ArrowUpRight size={17} /></button>
            </div>
          </>
        ) : (
          <div className="source-picker">
            <div className="source-icon"><ImagePlus size={25} /></div>
            <h2>Start with a photo</h2>
            <div className="source-options">
              <button className="source-option source-option--primary" onClick={onCameraChoose}><span className="source-option-icon"><Camera size={20} /></span><span><strong>Take a photo</strong><small>Use your camera</small></span><ArrowUpRight size={17} /></button>
              <button className="source-option" onClick={onChoose}><span className="source-option-icon"><FolderOpen size={20} /></span><span><strong>Choose from gallery</strong><small>Pick an outfit photo</small></span><ArrowUpRight size={17} /></button>
            </div>
            <span className="drop-hint mono">OR DROP A PHOTO HERE</span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
      }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onCameraFile(file);
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
        <span className="mono step-label">02 / READING YOUR FIT</span>
        <h1>Reading<br /><em>the details.</em></h1>
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
          <span className="mono step-label">03 / YOUR FIT READ</span>
          <h1>Your fit, <em>decoded.</em></h1>
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
            <span className="mono verdict-kicker">THE VERDICT</span>
            <h2>Good structure. Let the shirt breathe.</h2>
            <p>The charcoal overshirt gives the olive trousers a clean vertical line. The cream sneakers keep the contrast easy without flattening the look.</p>
          </div>

          <div className="tips-block">
            <span className="mono verdict-kicker">TWO EASY WINS</span>
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
          <h1>Your fits<br /><em>in one place.</em></h1>
        </div>
        <div className="streak-card">
          <span className="mono">CURRENT STREAK</span>
          <strong>04</strong>
          <span className="streak-copy">four looks developed<br />this week</span>
        </div>
      </div>

      <div className="history-summary">
        <div className="summary-copy"><span className="mono">SCORE OVER TIME</span><p>Track the looks that keep getting better.</p></div>
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("frame_014.jpg");
  const [dragActive, setDragActive] = useState(false);
  const [analysisIndex, setAnalysisIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [category, setCategory] = useState("");
  const [liveResult, setLiveResult] = useState<FitCheckResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analyzeFit = trpc.fitCheck.analyze.useMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  const photo = previewUrl ?? HERO_IMAGE;

  useEffect(() => {
    if (stage !== "analyzing") return;
    if (reducedMotion) return;
    const timer = window.setInterval(() => setAnalysisIndex((current) => (current + 1) % analysisMessages.length), 620);
    return () => window.clearInterval(timer);
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
    setSelectedFile(file);
    setFileName(file.name.toUpperCase());
    setSaved(false);
    setLiveResult(null);
    setStage("preview");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const useSample = () => {
    setPreviewUrl(HERO_IMAGE);
    setSelectedFile(null);
    setFileName("SAMPLE_FRAME_014.JPG");
    setSaved(false);
    setLiveResult(null);
    setStage("preview");
  };

  const startOver = () => {
    setStage("home");
    setPreviewUrl(null);
    setSelectedFile(null);
    setFileName("frame_014.jpg");
    setSaved(false);
    setLiveResult(null);
  };

  const submitForAnalysis = async () => {
    setAnalysisIndex(0);
    setAnalysisError(null);
    setStage("analyzing");
    try {
      const imageDataUrl = selectedFile ? await fileToDataUrl(selectedFile) : await urlToDataUrl(photo);
      const result = await analyzeFit.mutateAsync({ imageDataUrl, category: category || undefined });
      setLiveResult(result);
      setStage("results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read this fit. Please try again.";
      setAnalysisError(message);
      setStage("preview");
      toast("Fit check couldn’t finish.", { description: message });
    }
  };

  const share = async () => {
    const text = `My fit scored ${liveResult?.overall_score.toFixed(1) ?? "—"} on FitCheck — ${liveResult?.verdict ?? "my latest fit"}.`;
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
        {stage !== "home" && <nav className="topnav" aria-label="Primary navigation">
          <button className={stage !== "history" ? "is-active" : ""} onClick={startOver}>Workbench</button>
          <button className={stage === "history" ? "is-active" : ""} onClick={() => setStage("history")}>Archive <span className="nav-count">14</span></button>
        </nav>}
        <div className="topbar-tools">
          {stage !== "home" && <button className="topbar-new-fit" onClick={() => setStage("preview")}><ImagePlus size={14} /> New fit</button>}
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait" initial={false}>
          {stage === "home" && <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}><HomeView onDevelop={() => setStage("preview")} onSample={useSample} onHistory={() => setStage("history")} onGallery={() => { setStage("preview"); window.setTimeout(() => inputRef.current?.click(), 0); }} onCamera={() => { setStage("preview"); window.setTimeout(() => cameraInputRef.current?.click(), 0); }} /></motion.div>}
          {stage === "preview" && <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}><PreviewView photo={previewUrl} fileName={fileName} dragActive={dragActive} onChoose={() => inputRef.current?.click()} onCameraChoose={() => cameraInputRef.current?.click()} onFile={chooseFile} onCameraFile={chooseFile} onDrop={handleDrop} onDevelop={submitForAnalysis} onRetake={() => { setPreviewUrl(null); setFileName("frame_014.jpg"); setCategory(""); }} inputRef={inputRef} cameraInputRef={cameraInputRef} setDragActive={setDragActive} category={category} setCategory={setCategory} analysisError={analysisError} /></motion.div>}
          {stage === "analyzing" && <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}><AnalyzingView photo={photo} messageIndex={analysisIndex} /></motion.div>}
          {stage === "results" && <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}><PremiumResultsView photo={photo} result={liveResult} saved={saved} onSave={() => { setSaved(true); toast("Fit saved to your archive."); }} onShare={share} onAgain={() => setStage("preview")} /></motion.div>}
          {stage === "history" && <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}><HistoryView onBack={startOver} onDevelop={() => setStage("preview")} /></motion.div>}
        </AnimatePresence>
      </main>

      <footer className="site-footer"><span className="mono">FITCHECK / 2026</span><span className="footer-rule" /><span className="mono">CLOTHES ONLY. NEVER THE PERSON.</span><button className="footer-privacy">Privacy <ChevronRight size={13} /></button></footer>
    </div>
  );
}


function PremiumResultsView({
  photo,
  result,
  saved,
  onSave,
  onShare,
  onAgain,
}: {
  photo: string;
  result: FitCheckResult | null;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onAgain: () => void;
}) {
  const fallback: FitCheckResult = { overall_score: 8.7, scores: { outfit: { score: 9.0, visibility: "visible", reason: "Visible outfit cohesion." }, color: { score: 8.5, visibility: "visible", reason: "Visible color coordination." }, fit: { score: 8.2, visibility: "visible", reason: "Visible silhouette." }, shoes: { score: 8.8, visibility: "visible", reason: "Footwear is visible." }, styling: { score: 9.0, visibility: "visible", reason: "Visible styling choices." } }, verdict: "Looking clean.", strengths: ["Strong color coordination"], improvements: ["Try a cleaner sneaker"], summary: "The outfit has a strong casual direction with good color balance.", confidence: 0.86, image_quality: "good", coverage: { visible_categories: ["outfit", "color", "fit", "shoes", "styling"], unavailable_categories: [] } };
  const live = result ?? fallback;
  const breakdown = [
    { label: "Outfit", category: live.scores.outfit },
    { label: "Colors", category: live.scores.color },
    { label: "Fit", category: live.scores.fit },
    { label: "Shoes", category: live.scores.shoes },
    { label: "Styling", category: live.scores.styling },
  ];

  return (
    <section className="premium-results">
      <div className="premium-results-header">
        <span className="mono">FIT CHECK / YOUR RESULT</span>
        <span className="mono">FIT Nº 014</span>
      </div>
      <div className="result-hero-card">
        <div className="result-hero-photo"><img src={photo} alt="Your uploaded outfit" /><span className="result-photo-label">YOUR OUTFIT</span></div>
        <div className="result-score-panel">
          <span className="mono score-kicker">YOUR FIT SCORE</span>
          <div className="premium-score-wrap">
            <svg className="premium-score-ring" viewBox="0 0 210 210" aria-hidden="true">
              <circle className="premium-ring-track" cx="105" cy="105" r="88" pathLength="1" />
              <motion.circle className="premium-ring-progress" cx="105" cy="105" r="88" pathLength="1" initial={{ strokeDashoffset: 1 }} animate={{ strokeDashoffset: 1 - live.overall_score / 10 }} transition={{ duration: 1, ease: "easeOut", delay: .1 }} />
            </svg>
            <div className="premium-score-number"><strong>{live.overall_score.toFixed(1)}</strong><span>/10</span></div>
          </div>
          <h2 className="premium-verdict">{live.verdict}</h2>
          <p className="premium-score-note">{live.summary}</p>{live.coverage.unavailable_categories.length > 0 && <p className="coverage-note">Not visible: {live.coverage.unavailable_categories.join(", ")}.</p>}
        </div>
      </div>

      <div className="premium-result-grid">
        <div className="premium-main-column">
          <section className="result-section breakdown-card">
            <div className="result-section-heading"><div><span className="mono">01 / QUICK READ</span><h3>THE BREAKDOWN</h3></div><span className="section-badge">{live.coverage.visible_categories.length} visible</span></div>
            <div className="breakdown-list">
              {breakdown.map((item, index) => (
                <motion.div className="breakdown-item" key={item.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .06 }}>
                  <div className="breakdown-label"><span>{item.label}</span><strong>{item.category.score === null ? "Not visible" : item.category.score.toFixed(1)}</strong></div>
                  <div className="breakdown-track"><motion.span initial={{ width: 0 }} animate={{ width: `${(item.category.score ?? 0) * 10}%` }} transition={{ delay: .15 + index * .06, duration: .5 }} /></div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="result-section feedback-card">
            <span className="mono">02 / THE HUMAN READ</span>
            <h3>WHAT WE THINK</h3>
            <p>{live.summary}</p>
          </section>
        </div>

        <aside className="premium-side-column">
          <section className="level-up-card"><span className="mono">LEVEL IT UP</span><h3>One small move.</h3><p>{live.improvements[0] ?? "Try one small styling adjustment and check the balance again."}</p><span className="level-up-arrow">↗</span></section>
          <div className="result-meta-card"><span className="mono">WHAT’S WORKING</span><strong>{live.strengths[0] ?? "Strong visual balance"}</strong><span className="mono">CONFIDENCE / {Math.round(live.confidence * 100)}%</span></div>
        </aside>
      </div>

      <div className="premium-result-actions">
        <button className="btn btn--red premium-primary-action" onClick={onAgain}>TRY ANOTHER FIT <ArrowUpRight size={17} /></button>
        <button className="btn btn--quiet premium-share-action" onClick={onShare}><Share2 size={16} /> SHARE MY SCORE</button>
        <button className="save-link" onClick={onSave}>{saved ? <Check size={14} /> : <Bookmark size={14} />} {saved ? "Saved" : "Save fit"}</button>
      </div>
    </section>
  );
}
