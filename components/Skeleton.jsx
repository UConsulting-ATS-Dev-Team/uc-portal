import "../styles/skeleton.css";

// App-wide loading pattern: neutral skeleton bars in the same hairline
// card frame as the loaded content would use. Never a spinner.
export default function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton-card">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-bar" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}
