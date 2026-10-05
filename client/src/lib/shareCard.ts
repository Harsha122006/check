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
  const tags = (input.tags ?? [occasion, "Personal style"]).filter(Boolean).slice(0, 3).map((tag) => tag.toUpperCase());
  const verdictSvg = verdictLines.map((line, index) => `<text x="80" y="1515" dy="${index * 68}" class="verdict">${escapeXml(line)}</text>`).join("");
  const takeawaySvg = takeawayLines.map((line, index) => `<text x="80" y="1705" dy="${index * 38}" class="takeaway">${escapeXml(line)}</text>`).join("");
  const tagSvg = tags.length ? `<text x="80" y="1828" class="tag">${tags.map(escapeXml).join("  ·  ")}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs>
      <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18232A" stop-opacity="0"/><stop offset="1" stop-color="#18232A" stop-opacity=".34"/></linearGradient>
      <clipPath id="photoClip"><rect x="80" y="160" width="920" height="1080" rx="28"/></clipPath>
      <style>
        .brand{font:700 30px Arial,sans-serif;letter-spacing:-1.2px;fill:#18232A}.mono{font:700 18px Arial,sans-serif;letter-spacing:4px;fill:#687277}.score{font:400 236px Georgia,serif;letter-spacing:-14px;fill:#18232A}.scoreUnit{font:700 34px Arial,sans-serif;fill:#687277}.verdict{font:400 62px Georgia,serif;letter-spacing:-2.5px;fill:#18232A}.takeaway{font:400 27px Arial,sans-serif;fill:#5C666A}.tag{font:700 19px Arial,sans-serif;letter-spacing:2.5px;fill:#687277}.footer{font:700 17px Arial,sans-serif;letter-spacing:3px;fill:#687277}
      </style>
    </defs>
    <rect width="1080" height="1920" fill="#FBFAF7"/>
    <g transform="translate(80 76)"><rect width="48" height="48" rx="10" fill="#18232A"/><path d="M15 12h20v6H21v20h-6zM27 23h12v6H27z" fill="#FBFAF7"/><text x="68" y="33" class="brand">FitCheck</text></g>
    <text x="1000" y="107" text-anchor="end" class="mono">${escapeXml(occasion.toUpperCase())}</text>
    <g clip-path="url(#photoClip)"><image x="80" y="160" width="920" height="1080" preserveAspectRatio="xMidYMid slice" href="${escapeXml(imageHref(input.photo))}" xlink:href="${escapeXml(imageHref(input.photo))}"/><rect x="80" y="790" width="920" height="450" fill="url(#photoShade)"/></g>
    <text x="80" y="1320" class="mono">FIT SCORE</text><text x="80" y="1390" class="score">${escapeXml(formatShareScore(input.score).replace("/10", ""))}</text><text x="420" y="1387" class="scoreUnit">/10</text>
    ${verdictSvg}<text x="80" y="1660" class="mono">THE TAKEAWAY</text>${takeawaySvg}${tagSvg}
    <line x1="80" y1="1860" x2="1000" y2="1860" stroke="#D8D8D2" stroke-width="2"/><text x="80" y="1900" class="footer">FITCHECK</text><text x="1000" y="1900" text-anchor="end" class="footer">YOUR FIT, YOUR SCORE</text>
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
