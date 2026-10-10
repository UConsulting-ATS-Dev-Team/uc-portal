import { useCallback, useEffect, useState } from "react";
import { fetchEvents, fetchLessons, fetchMeetingSchedule, fetchOwnAttendance, fetchOwnCoffeeChats, fetchOwnSubmissions } from "./acceleratorSync.js";

// Everything an intern's accelerator pages read, loaded together: the lessons, the calendar events, and the
// signed-in intern's own submissions, attendance and coffee chats. `reload` refetches after a write.
export function useAcceleratorData() {
  const [data, setData] = useState({ lessons: [], events: [], submissions: [], attendance: [], chats: [], schedule: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    return Promise.all([fetchLessons(), fetchEvents(), fetchOwnSubmissions(), fetchOwnAttendance(), fetchOwnCoffeeChats(), fetchMeetingSchedule()])
      .then(([lessons, events, submissions, attendance, chats, schedule]) => {
        setData({ lessons, events, submissions, attendance, chats, schedule });
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, loading, error, reload: load };
}
