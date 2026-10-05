interface StoreQrPosterOptions {
  qrCanvas: HTMLCanvasElement;
  name: string;
  url: string;
}

const posterWidth = 1080;
const posterHeight = 1350;

function wrapText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= width) { line = candidate; continue; }
    if (line) { lines.push(line); line = ""; }
    // Also wrap a long unbroken name or URL, without losing characters.
    for (const character of Array.from(word)) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line); line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(context: CanvasRenderingContext2D, text: string, width: number, maxLines: number,
  size: number, weight: number, fontFamily: string, maxHeight = Infinity) {
  let lines: string[];
  do {
    context.font = `${weight} ${size}px ${fontFamily}`;
    lines = wrapText(context, text, width);
    if ((lines.length <= maxLines && lines.length * size * 1.15 <= maxHeight) || size <= 1) break;
    size -= 1;
  } while (true);
  return { lines, size };
}

/** Compose the existing QR into a poster; never generate or alter its payload. */
export function createStoreQrPoster({ qrCanvas, name, url }: StoreQrPosterOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = posterWidth;
  canvas.height = posterHeight;
  const context = canvas.getContext("2d");
  if (!context || !qrCanvas.width || !qrCanvas.height) throw new Error("poster_unavailable");

  const tokens = getComputedStyle(document.documentElement);
  const color = (token: string, fallback: string) => tokens.getPropertyValue(token).trim() || fallback;
  const green = color("--green", "#196747");
  const ink = color("--ink", "#192f27");
  const muted = color("--muted", "#5c6d64");
  const fontFamily = getComputedStyle(document.body).fontFamily || '"Segoe UI", Arial, sans-serif';
  const center = posterWidth / 2;

  context.fillStyle = color("--paper", "#f6f8f5");
  context.fillRect(0, 0, posterWidth, posterHeight);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(40, 40, 1000, 1270, 36);
  context.fill();
  context.fillStyle = green;
  context.beginPath();
  context.roundRect(40, 40, 1000, 14, [36, 36, 0, 0]);
  context.fill();

  // Same wordmark, location icon and colors used by CercaYa's existing Brand.
  context.font = `750 62px ${fontFamily}`;
  context.textBaseline = "middle";
  const segments = [{ text: "Cerca", color: ink }, { text: "Ya", color: green },
    { text: ".", color: color("--secondary", "#456b60") }];
  const wordWidth = segments.reduce((total, segment) => total + context.measureText(segment.text).width, 0);
  const iconX = center - (76 + 20 + wordWidth) / 2;
  context.fillStyle = green;
  context.beginPath();
  context.roundRect(iconX, 106, 76, 76, [20, 20, 20, 4]);
  context.fill();
  context.save();
  context.translate(iconX + 17, 123);
  context.scale(42 / 24, 42 / 24);
  context.strokeStyle = color("--lime", "#d7ed9c");
  context.lineWidth = 2.7;
  context.lineCap = "round";
  context.lineJoin = "round";
  // Lucide MapPin outline, matching the icon rendered in the modal.
  context.stroke(new Path2D("M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"));
  context.beginPath(); context.arc(12, 10, 3, 0, Math.PI * 2); context.stroke();
  context.restore();
  let wordX = iconX + 96;
  for (const segment of segments) {
    context.fillStyle = segment.color;
    context.fillText(segment.text, wordX, 144);
    wordX += context.measureText(segment.text).width;
  }

  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = muted;
  context.font = `400 26px ${fontFamily}`;
  context.fillText("Encontralo cerca. Tenelo hoy.", center, 204);
  context.strokeStyle = color("--line", "#dde6df");
  context.lineWidth = 2;
  context.beginPath(); context.moveTo(120, 246); context.lineTo(960, 246); context.stroke();

  // The name has its own fixed area; smaller type keeps long names out of the QR.
  const fittedName = fitText(context, name.trim() || "Tu comercio", 840, 3, 64, 750, fontFamily, 180);
  const nameLineHeight = fittedName.size * 1.15;
  const nameTop = 266 + (180 - fittedName.lines.length * nameLineHeight) / 2;
  context.fillStyle = ink;
  fittedName.lines.forEach((line, index) => context.fillText(line, center, nameTop + index * nameLineHeight));
  context.font = `650 42px ${fontFamily}`;
  context.fillStyle = green;
  context.fillText("Encontrame en CercaYa", center, 472);

  context.fillStyle = "#ffffff";
  context.beginPath(); context.roundRect(248, 548, 584, 584, 24); context.fill();
  context.strokeStyle = color("--line", "#dde6df"); context.stroke();
  // Preserve black/white modules and the QR's existing four-module quiet zone.
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(qrCanvas, 284, 584, 512, 512);
  context.restore();

  const instruction = fitText(context, "Escaneá para ver mis productos, precios y disponibilidad.", 840, 2, 30, 400, fontFamily);
  context.fillStyle = ink;
  instruction.lines.forEach((line, index) => context.fillText(line, center, 1148 + index * instruction.size * 1.25));

  context.font = `400 22px ${fontFamily}`;
  context.fillStyle = muted;
  const urlLines = wrapText(context, url, 840);
  const visibleUrlLines = urlLines.slice(0, 2);
  if (urlLines.length > 2) {
    let lastLine = visibleUrlLines[1];
    while (lastLine && context.measureText(`${lastLine}…`).width > 840) lastLine = Array.from(lastLine).slice(0, -1).join("");
    visibleUrlLines[1] = `${lastLine}…`;
  }
  // Only the printed label can shorten; the QR and copied link retain the full URL.
  visibleUrlLines.forEach((line, index) => context.fillText(line, center, 1238 + index * 28));
  return canvas;
}
