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
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SHARE_CARD_WIDTH}" height="${SHARE_CARD_HEIGHT}" viewBox="0 0 ${SHARE_CARD_WIDTH} ${SHARE_CARD_HEIGHT}">
    <defs>
      <linearGradient id="posterBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#344A5B"/><stop offset=".56" stop-color="#14191F"/><stop offset="1" stop-color="#050608"/></linearGradient>
      <clipPath id="photoClip"><rect x="84" y="116" width="912" height="1120" rx="30"/></clipPath>
      <style>
        .score{font:700 118px Arial,sans-serif;letter-spacing:-5px;fill:#FFFFFF}.unit{font:700 34px Arial,sans-serif;fill:#FF756D}.brand{font:700 42px Arial,sans-serif;letter-spacing:-1.8px;fill:#FFFFFF}
      </style>
    </defs>
    <rect width="1080" height="1920" fill="url(#posterBg)"/>
    <rect x="68" y="100" width="944" height="1152" rx="38" fill="#0B0D10" opacity=".45"/>
    <g clip-path="url(#photoClip)"><image x="84" y="116" width="912" height="1120" preserveAspectRatio="xMidYMid slice" href="${escapeXml(imageHref(input.photo))}" xlink:href="${escapeXml(imageHref(input.photo))}"/></g>
    <text x="540" y="1405" text-anchor="middle" class="score">${escapeXml(formatShareScore(input.score))}</text>
    <g transform="translate(440 1510)"><rect width="58" height="58" rx="14" fill="#FF756D"/><path d="M18 14h25v8H26v23h-8zM32 27h15v8H32z" fill="#18232A"/><text x="76" y="41" class="brand">FitCheck</text></g>
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
