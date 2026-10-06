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

export function imageSourceNeedsEmbedding(photo: string) {
  return !photo.startsWith("data:");
}

function imageHref(photo: string) {
  return photo.startsWith("data:") || photo.startsWith("blob:") ? photo : new URL(photo, window.location.href).href;
}

async function imageDataUrl(photo: string) {
  if (!imageSourceNeedsEmbedding(photo)) return photo;
  const response = await fetch(imageHref(photo), { credentials: "same-origin" });
  if (!response.ok) throw new Error("SHARE_CARD_PHOTO_FETCH_FAILED");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("SHARE_CARD_PHOTO_READ_FAILED"));
    reader.onerror = () => reject(new Error("SHARE_CARD_PHOTO_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

function buildShareSvg(input: ShareCardInput) {
  const occasion = (input.occasion || "Casual").trim();
  const verdictLines = wrapShareText(input.verdict, 29, 2);
  const takeawayLines = wrapShareText(input.takeaway, 43, 2);
  const tags = (input.tags ?? [occasion, "Personal style"]).filter(Boolean).slice(0, 2).map((tag) => tag.toUpperCase());
  const verdictSvg = verdictLines.map((line, index) => `<text x="80" y="1558" dy="${index * 66}" class="verdict">${escapeXml(line)}</text>`).join("");
  const takeawaySvg = takeawayLines.map((line, index) => `<text x="80" y="1726" dy="${index * 36}" class="takeaway">${escapeXml(line)}</text>`).join("");
  const tagSvg = tags.length ? `<text x="80" y="1838" class="tag">${tags.map(escapeXml).join("   ·   ")}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs>
      <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18232A" stop-opacity=".56"/><stop offset=".24" stop-color="#18232A" stop-opacity="0"/><stop offset=".72" stop-color="#18232A" stop-opacity="0"/><stop offset="1" stop-color="#18232A" stop-opacity=".68"/></linearGradient>
      <style>
        .brand{font:700 31px Arial,sans-serif;letter-spacing:-1.2px;fill:#FBFAF7}.mono{font:700 18px Arial,sans-serif;letter-spacing:4px;fill:#FF756D}.score{font:400 270px Georgia,serif;letter-spacing:-16px;fill:#FBFAF7}.scoreUnit{font:700 34px Arial,sans-serif;fill:#FF756D}.verdict{font:400 62px Georgia,serif;letter-spacing:-2.5px;fill:#FBFAF7}.takeaway{font:400 27px Arial,sans-serif;fill:#C4CFD0}.tag{font:700 18px Arial,sans-serif;letter-spacing:2.8px;fill:#FF756D}.footer{font:700 16px Arial,sans-serif;letter-spacing:3px;fill:#8E9A9C}
      </style>
    </defs>
    <rect width="1080" height="1920" fill="#18232A"/>
    <image x="0" y="0" width="1080" height="1160" preserveAspectRatio="xMidYMid slice" href="${escapeXml(imageHref(input.photo))}" xlink:href="${escapeXml(imageHref(input.photo))}"/>
    <rect x="0" y="0" width="1080" height="1160" fill="url(#photoShade)"/>
    <g transform="translate(72 72)"><rect width="50" height="50" rx="12" fill="#FF756D"/><path d="M16 13h22v7H23v21h-7zM29 25h13v7H29z" fill="#18232A"/><text x="70" y="35" class="brand">FitCheck</text></g>
    <text x="1008" y="107" text-anchor="end" class="mono">${escapeXml(occasion.toUpperCase())}</text>
    <rect x="0" y="1080" width="1080" height="840" fill="#18232A"/>
    <rect x="72" y="1150" width="72" height="8" rx="4" fill="#FF756D"/>
    <text x="72" y="1240" class="mono">FIT SCORE</text><text x="72" y="1450" class="score">${escapeXml(formatShareScore(input.score).replace("/10", ""))}</text><text x="420" y="1448" class="scoreUnit">/10</text>
    ${verdictSvg}<text x="80" y="1680" class="mono">THE TAKEAWAY</text>${takeawaySvg}${tagSvg}
    <line x1="80" y1="1870" x2="1000" y2="1870" stroke="#3C4A4D" stroke-width="2"/><text x="80" y="1906" class="footer">FITCHECK</text><text x="1000" y="1906" text-anchor="end" class="footer">YOUR FIT, YOUR SCORE</text>
  </svg>`;
}

export async function createShareCardBlob(input: ShareCardInput): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("SHARE_CARD_UNAVAILABLE");
  const embeddedPhoto = await imageDataUrl(input.photo);
  const svg = buildShareSvg({ ...input, photo: embeddedPhoto });
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
