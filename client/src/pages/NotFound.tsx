/*
 * FitCheck style reminder: utility routes stay on the light table.
 * Treat an error as a missing or undeveloped frame, never a generic web card.
 */
import { ArrowLeft, ArrowUpRight, ScanLine } from "lucide-react";

const MARK_IMAGE = "/manus-storage/fitcheck-mark_9e62fd59.png";

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

export default function NotFound() {
  return (
    <div className="fitcheck-shell missing-frame-page">
      <header className="topbar">
        <a href="/" className="brand-button" aria-label="Back to FitCheck workbench">
          <span className="fit-mark"><img src={MARK_IMAGE} alt="" /><span className="fit-wordmark">FITCHECK</span></span>
        </a>
        <span className="mono live-indicator"><span /> LOCAL MODE</span>
      </header>
      <main className="missing-frame-main">
        <div className="missing-index mono">ARCHIVE / CONTACT SHEET / GAP 404</div>
        <div className="missing-frame-wrap">
          <div className="missing-frame">
            <CropMarks />
            <div className="missing-inner">
              <span className="missing-icon"><ScanLine size={22} /></span>
              <span className="mono">FRAME NOT DEVELOPED</span>
              <strong>404</strong>
              <p>The frame you were looking for is out of the sheet.</p>
              <a href="/" className="btn btn--red">Return to the workbench <ArrowUpRight size={16} /></a>
            </div>
          </div>
          <div className="missing-caption">
            <span className="mono">NEGATIVE / 404</span>
            <span className="mono">NO CLEAR READ</span>
          </div>
        </div>
        <div className="missing-note">
          <span className="mono">EDITOR'S NOTE</span>
          <span className="missing-note-line" />
          <p>Nothing to score here. Develop a new fit instead.</p>
          <a href="/" className="text-button"><ArrowLeft size={14} /><span className="button-under">Back to workbench</span></a>
        </div>
      </main>
      <footer className="site-footer"><span className="mono">FITCHECK / 2026</span><span className="footer-rule" /><span className="mono">CLOTHES ONLY. NEVER THE PERSON.</span></footer>
    </div>
  );
}
