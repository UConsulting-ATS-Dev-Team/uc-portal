import { useEffect, useState } from "react";
import { chatPhotoUrl } from "../data/acceleratorSync.js";
import "../styles/accelerator.css";

// A coffee chat's picture. The bucket is private, so the image loads through a short-lived signed URL (an
// intern can read their own, an admin any).
export default function AcceleratorChatPhoto({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    chatPhotoUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url ? <img className="accel-chat__photo" src={url} alt="" /> : <div className="accel-chat__photo" />;
}
