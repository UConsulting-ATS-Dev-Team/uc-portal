import { useEffect, useState } from "react";
import { eventPhotoUrl } from "../data/acceleratorSync.js";
import "../styles/accelerator.css";

// The photo an intern submitted from an event. Private bucket, so it loads through a short-lived signed URL (an
// intern can read their own, an admin any). Opens full size in a new tab.
export default function AcceleratorEventPhoto({ path }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    eventPhotoUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <div className="accel-photo-thumb" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label="Open photo">
      <img className="accel-photo-thumb" src={url} alt="" />
    </a>
  );
}
