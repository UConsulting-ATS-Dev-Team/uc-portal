const LEVER_COPY = {
  prep: "Log more prep time",
  networking: "Chat with more UC connections here",
};

// 11/12/13 always take "th" (eleventh/twelfth/thirteenth), everything else
// keys off the last digit -- the plain `${n}th` this replaces rendered every
// percentile as "Nth", including the very common case of a number ending in
// 1/2/3 (e.g. "53th" instead of "53rd").
function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// Presentational only -- takes an already-computed `odds` object (same
// shape data/oddsModel.js's computeOdds() and data/realOddsModel.js's
// computeRealOdds() both return: headline, openMarketBaseline, pastUCRate,
// percentile, factors[], lever, prepHours, plus two optional real-odds-only
// fields, headlineLabel/methodologyNote) so this one component renders both
// the mock and the real odds model unmodified. Callers own the compute step
// (JobDetail.jsx calls computeOdds() synchronously; RealJobDetail.jsx awaits
// computeRealOdds()'s async inputs first) since that's exactly the part
// that differs structurally between mock and real data.
export default function OddsModel({ odds, onLogPrep }) {
  return (
    <div className="detail-section">
      <h2 className="detail-section__title">Your realistic odds</h2>
      <div className="odds-layout">
        <div className="odds-left">
          <div className="odds-headline">{odds.headline}%</div>
          <div className="odds-headline-label">{odds.headlineLabel || "Estimated chance of an offer"}</div>
          {odds.methodologyNote && (
            <p className="meta" style={{ marginTop: "var(--space-2)" }}>
              {odds.methodologyNote}
            </p>
          )}
          <div className="odds-comparison">
            <span>Open-market baseline</span>
            <span>{odds.openMarketBaseline}%</span>
          </div>
          <div className="odds-comparison">
            <span>Past UC applicants</span>
            <span>{odds.pastUCRate}%</span>
          </div>
          <div className="odds-comparison">
            <span>Your percentile in UC</span>
            <span>{ordinal(odds.percentile)}</span>
          </div>
        </div>

        <div className="odds-right">
          <table className="factor-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Where you stand</th>
                <th>Weight</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {odds.factors.map((f) => (
                <tr key={f.key}>
                  <td>{f.label}</td>
                  <td className="factor-table__signal">
                    {f.signal}
                    {f.lowConfidence && <span className="factor-table__low-confidence">{f.lowConfidenceNote}</span>}
                  </td>
                  <td>{Math.round(f.weight * 100)}%</td>
                  <td>
                    <div className="factor-bar-track">
                      <div
                        className={`factor-bar-fill ${f.score >= 0.6 ? "is-strength" : "is-weakness"}`}
                        style={{ width: `${Math.round(f.score * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="lever-callout">
            <span>
              <strong>Biggest lever:</strong> {LEVER_COPY[odds.lever.key]} would move you to an estimated{" "}
              <strong>{odds.lever.projectedEstimate}%</strong>.
            </span>
            <button className="btn btn-primary" onClick={onLogPrep}>
              Log prep
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
