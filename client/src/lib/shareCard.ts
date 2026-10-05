export type ShareCardInput = {
  photo: string;
  score: number;
  occasion?: string;
  verdict: string;
  takeaway: string;
  tags?: string[];
};

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

export function formatShareScore(score: number) {
  return `${score.toFixed(1)}/10`;
}

export function wrapShareText(value: string, maxChars = 34, maxLines = 3) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxChars) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.…]+$/, "").slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

function imageHref(photo: string) {
  return photo.startsWith("data:") || photo.startsWith("blob:") ? photo : new URL(photo, window.location.href).href;
}

function buildShareSvg(input: ShareCardInput) {
  const occasion = (input.occasion || "Casual").trim();
  const verdictLines = wrapShareText(input.verdict, 27, 2);
  const takeawayLines = wrapShareText(input.takeaway, 38, 3);
  const tags = (input.tags ?? [occasion, "Personal style"]).filter(Boolean).slice(0, 3);
  const verdictSvg = verdictLines.map((line, index) => `<text x="80" y="1378" dy="${index * 66}" class="verdict">${escapeXml(line)}</text>`).join("");
  const takeawaySvg = takeawayLines.map((line, index) => `<text x="80" y="1542" dy="${index * 42}" class="takeaway">${escapeXml(line)}</text>`).join("");
  const tagSvg = tags.map((tag, index) => `<g transform="translate(${80 + index * 238} 1745)"><rect width="212" height="54" rx="27" fill="#E6F0FF"/><text x="106" y="35" text-anchor="middle" class="tag">${escapeXml(tag)}</text></g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDFC"/><stop offset="1" stop-color="#EAF5F4"/></linearGradient>
      <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18232A" stop-opacity="0"/><stop offset="1" stop-color="#18232A" stop-opacity=".34"/></linearGradient>
      <clipPath id="photoClip"><rect x="80" y="170" width="920" height="1010" rx="42"/></clipPath>
      <style>
        .brand{font:700 30px Arial,sans-serif;letter-spacing:-1.2px;fill:#18232A}.mono{font:700 20px Arial,sans-serif;letter-spacing:4px;fill:#4868FF}.score{font:400 214px Georgia,serif;letter-spacing:-12px;fill:#18232A}.scoreUnit{font:700 34px Arial,sans-serif;fill:#4868FF}.occasion{font:700 22px Arial,sans-serif;letter-spacing:3px;fill:#4868FF}.verdict{font:400 58px Georgia,serif;letter-spacing:-2px;fill:#18232A}.takeaway{font:400 27px Arial,sans-serif;fill:#5C6A70}.tag{font:700 19px Arial,sans-serif;fill:#4868FF}.footer{font:700 18px Arial,sans-serif;letter-spacing:3px;fill:#7A8588}
      </style>
    </defs>
    <rect width="1080" height="1920" fill="url(#paper)"/>
    <circle cx="925" cy="110" r="150" fill="#D8F0EC" opacity=".75"/><circle cx="70" cy="1810" r="210" fill="#FFF0D5" opacity=".68"/>
    <g transform="translate(80 88)"><rect width="54" height="54" rx="12" fill="#18232A"/><path d="M17 14h22v6H23v20h-6zM29 25h13v6H29z" fill="#FFFDFC"/><text x="76" y="37" class="brand">FitCheck</text></g>
    <text x="80" y="152" class="mono">YOUR FIT / ${escapeXml(occasion.toUpperCase())}</text>
    <g clip-path="url(#photoClip)"><image x="80" y="170" width="920" height="1010" preserveAspectRatio="xMidYMid slice" href="${escapeXml(imageHref(input.photo))}" xlink:href="${escapeXml(imageHref(input.photo))}"/><rect x="80" y="730" width="920" height="450" fill="url(#photoShade)"/></g>
    <rect x="80" y="170" width="920" height="1010" rx="42" fill="none" stroke="#D8E0E3" stroke-width="3"/>
    <text x="80" y="1280" class="mono">FIT SCORE</text><text x="80" y="1340" class="score">${escapeXml(formatShareScore(input.score).replace("/10", ""))}</text><text x="408" y="1338" class="scoreUnit">/10</text>
    ${verdictSvg}<text x="80" y="1490" class="mono">THE TAKEAWAY</text>${takeawaySvg}${tagSvg}
    <line x1="80" y1="1840" x2="1000" y2="1840" stroke="#D8E0E3" stroke-width="2"/><text x="80" y="1884" class="footer">FITCHECK / PERSONAL STYLE READ</text><text x="1000" y="1884" text-anchor="end" class="footer">SHARE YOUR FIT</text>
  </svg>`;
}

export async function createShareCardBlob(input: ShareCardInput): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("SHARE_CARD_UNAVAILABLE");
  const svg = buildShareSvg(input);
  const svgBlob = new Blob([svg], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("SHARE_CARD_IMAGE_FAILED")); });
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_CARD_WIDTH;
    canvas.height = SHARE_CARD_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("SHARE_CARD_CANVAS_UNAVAILABLE");
    context.drawImage(image, 0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("SHARE_CARD_EXPORT_FAILED")), "image/png", 0.95));
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
