import { useCallback, useEffect, useState } from "react";
import { fetchLibraryResources, fetchLearningTracks } from "./librarySync.js";

// Fetches the (small, admin-curated) library once per mount. `error` is set
// if either table can't be read -- e.g. before the library migration has
// been applied -- and pages fall back to their honest empty state rather
// than crashing.
export function useLibrary() {
  const [resources, setResources] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([fetchLibraryResources(), fetchLearningTracks()])
      .then(([r, t]) => {
        setResources(r);
        setTracks(t);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { resources, tracks, loading, error, reload };
}
