import { computeOdds } from "../data/oddsModel.js";

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

export default function OddsModel({ job, extraPrepHours, onLogPrep }) {
  const odds = computeOdds(job, { extraPrepHours });

  return (
    <div className="detail-section">
      <h2 className="detail-section__title">Your realistic odds</h2>
      <div className="odds-layout">
        <div className="odds-left">
          <div className="odds-headline">{odds.headline}%</div>
          <div className="odds-headline-label">Estimated chance of an offer</div>
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
                    {f.lowConfidence && <span className="factor-table__low-confidence">n={job.pastCycleApplicants} · limited data</span>}
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
