/** Transforme un SVG (dimensionné en mm) en canvas de lPx × hPx. */
export async function svgVersCanvas(svg: string, lPx: number, hPx: number): Promise<HTMLCanvasElement> {
  const sized = svg.replace(/width="[^"]+mm" height="[^"]+mm"/, `width="${lPx}" height="${hPx}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("Rendu SVG impossible")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = lPx; c.height = hPx;
    c.getContext("2d")!.drawImage(img, 0, 0, lPx, hPx);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const versBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("PNG impossible"))), "image/png"));
