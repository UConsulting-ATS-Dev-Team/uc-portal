import { useEffect, useState } from "react";

// iPhones save photos as HEIC, which Safari shows but Chrome and Windows cannot. Two small pieces make them work everywhere:
// new uploads are turned into JPEG in the browser before they are stored, and a HEIC already stored is converted on the fly when
// a browser can't draw it. The converter is loaded only when a HEIC actually turns up, so nobody else pays for it.

export const isHeic = (nameOrType = "") => /heic|heif/i.test(nameOrType);

async function heicToJpeg(blob) {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob, toType: "image/jpeg", quality: 0.85 });
  return Array.isArray(out) ? out[0] : out;
}

// A file ready to upload: a HEIC picture becomes a JPEG (named .jpg); anything else, or a HEIC that can't be converted, is
// returned unchanged.
export async function prepareImageForUpload(file) {
  if (!file || !(isHeic(file.type) || isHeic(file.name.split(".").pop()))) return file;
  try {
    const jpeg = await heicToJpeg(file);
    return new File([jpeg], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// For showing a stored image: the address to use, plus an onError handler. If the browser can't draw the file and it is a HEIC, it
// is downloaded and converted, and the converted copy replaces it. Windows and Chrome users get a normal picture either way.
export function useViewableImage(url, path) {
  const [src, setSrc] = useState(url);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setSrc(url);
    setTried(false);
  }, [url]);
  useEffect(() => () => src && src !== url && src.startsWith("blob:") && URL.revokeObjectURL(src), [src, url]);

  async function onError() {
    if (tried || !url || !isHeic(path)) return;
    setTried(true);
    try {
      const blob = await (await fetch(url)).blob();
      setSrc(URL.createObjectURL(await heicToJpeg(blob)));
    } catch {
      // Leave the broken image as it is; the original is still reachable from the link.
    }
  }
  return { src, onError };
}
