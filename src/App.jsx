import { useState, useCallback } from "react";
import "./App.css";

const defaultCriteria = [
  {
    id: "price",
    name: "Price vs. Baseline ($40,000)",
    type: "price",
    basePrice: 40000,
    pointsPerThousand: -1,
  },
  {
    id: "odometer",
    name: "Odometer (miles)",
    type: "range_score",
    thresholds: [
      { max: 20000, points: 10 },
      { max: 40000, points: 8 },
      { max: 60000, points: 3 },
      { max: 80000, points: 0 },
      { max: 100000, points: -5 },
      { max: Infinity, points: -10 },
    ],
  },
  {
    id: "wheels",
    name: "Wheel Size",
    type: "select",
    options: [
      { value: "20", label: '20" Wheels', points: 5 },
      { value: "22", label: '22" Wheels', points: 0 },
    ],
  },
  {
    id: "seats",
    name: "Seating Configuration",
    type: "select",
    options: [
      { value: "7", label: "7 Seats", points: 5 },
      { value: "6", label: "6 Seats", points: 0 },
      { value: "5", label: "5 Seats", points: -10 },
    ],
  },
  {
    id: "tow_hitch",
    name: "Tow Hitch",
    type: "conditional_boolean",
    note: "More valuable with 6-seat config",
    basePoints: 5,
    conditionalPoints: { when: "seats", equals: "6", bonus: 5 },
  },
  {
    id: "hardware",
    name: "Autopilot Hardware",
    type: "select",
    options: [
      { value: "hw4", label: "HW4 (AI4)", points: 10 },
      { value: "hw3", label: "HW3 (FSD Computer)", points: 0 },
      { value: "ap2", label: "AP2", points: -5 },
      { value: "ap1", label: "AP1", points: -10 },
    ],
  },
  {
    id: "fsd",
    name: "FSD Purchased",
    type: "boolean",
    basePoints: 5,
  },
  {
    id: "warranty",
    name: "Remaining CPO / Warranty",
    type: "boolean",
    basePoints: 5,
  },
];

const SCORE_COLOR = (score) => {
  if (score >= 30) return "#22c55e";
  if (score >= 15) return "#84cc16";
  if (score >= 5) return "#eab308";
  if (score >= -15) return "#f97316";
  return "#ef4444";
};

const SCORE_LABEL = (score) => {
  if (score >= 30) return "Excellent Deal";
  if (score >= 15) return "Good Buy";
  if (score >= 5) return "Acceptable";
  if (score >= 0) return "Questionable";
  return "Avoid";
};

const ptClass = (p) => (p > 0 ? "pts-pos" : p < 0 ? "pts-neg" : "pts-neu");
const ptStr = (p) => `${p >= 0 ? "+" : ""}${p}`;

// Tesla VIN: position 4 = model (X,S,3,Y), position 10 = model year, positions 12-17 = sequential serial (same plant/year ≈ later build)
const VIN_YEAR = { C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026 };
// Model X 2023: HW4 started Feb 2023; transition reported around serial 370000–380000. Use 375000 as cutoff (estimate only).
const MODEL_X_2023_HW4_SERIAL_CUTOFF = 375000;
function estimateHardwareFromVin(vin) {
  const v = (vin || "").trim().toUpperCase();
  if (v.length !== 17) return null;
  const modelChar = v.charAt(3);   // position 4 (1-based): X, S, 3, Y
  const yearChar = v.charAt(9);
  const year = VIN_YEAR[yearChar];
  if (year == null) return null;
  const serialStr = v.slice(11, 17);  // positions 12-17
  const serial = /^\d{6}$/.test(serialStr) ? parseInt(serialStr, 10) : null;
  const isModelX = modelChar === "X";
  if (isModelX && year === 2023 && serial != null) {
    const likelyFebOrLater = serial >= MODEL_X_2023_HW4_SERIAL_CUTOFF;
    return {
      year,
      model: "Model X",
      serial,
      hardware: likelyFebOrLater ? "hw4" : "hw3",
      label: likelyFebOrLater ? "HW4 (AI4)" : "HW3 (FSD Computer)",
      note: likelyFebOrLater
        ? "Est. Feb 2023+ from serial (≥375k)"
        : "Est. before Feb 2023 from serial (<375k)",
    };
  }
  if (year >= 2024) return { year, model: modelChar, hardware: "hw4", label: "HW4 (AI4)" };
  if (year === 2023) return { year, model: modelChar, hardware: "hw4", label: "HW4 (AI4)" }; // S/3/Y 2023
  if (year >= 2019) return { year, model: modelChar, hardware: "hw3", label: "HW3 (FSD Computer)" };
  if (year >= 2017) return { year, model: modelChar, hardware: "ap2", label: "AP2" };
  if (year >= 2016) return { year, model: modelChar, hardware: "ap2", label: "AP2" };
  return { year, model: modelChar, hardware: "ap1", label: "AP1" };
}

export default function TeslaRubric() {
  const [criteria, setCriteria] = useState(defaultCriteria);
  const [selections, setSelections] = useState({});
  const [tab, setTab] = useState("evaluate");
  const [editingId, setEditingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCrit, setNewCrit] = useState({ name: "", type: "boolean", basePoints: 1 });
  const [vinForHw, setVinForHw] = useState("");

  const setSelection = (id, val) => setSelections((s) => ({ ...s, [id]: val }));
  const hwEstimate = estimateHardwareFromVin(vinForHw);
  const applyHwEstimate = () => {
    if (hwEstimate) setSelection("hardware", hwEstimate.hardware);
  };

  const computeScore = useCallback(() => {
    let total = 0;
    const details = [];
    for (const c of criteria) {
      const val = selections[c.id];
      if (c.type === "select") {
        const opt = c.options?.find((o) => o.value === val);
        if (opt) { total += opt.points; details.push({ name: c.name, points: opt.points, label: opt.label }); }
      } else if (c.type === "boolean") {
        if (val === true) { total += c.basePoints; details.push({ name: c.name, points: c.basePoints, label: "Yes" }); }
      } else if (c.type === "conditional_boolean") {
        if (val === true) {
          let pts = c.basePoints;
          if (c.conditionalPoints && selections[c.conditionalPoints.when] === c.conditionalPoints.equals)
            pts += c.conditionalPoints.bonus;
          total += pts;
          details.push({ name: c.name, points: pts, label: "Yes" });
        }
      } else if (c.type === "price") {
        const price = parseFloat(val);
        if (!isNaN(price)) {
          const pts = -((price - c.basePrice) / 1000) * Math.abs(c.pointsPerThousand);
          total += pts;
          details.push({ name: c.name, points: pts, label: `$${price.toLocaleString()}` });
        }
      } else if (c.type === "range_score") {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          const t = c.thresholds.find((th) => num <= th.max);
          if (t) { total += t.points; details.push({ name: c.name, points: t.points, label: `${num.toLocaleString()} mi` }); }
        }
      }
    }
    return { total: Math.round(total * 10) / 10, details };
  }, [criteria, selections]);

  const { total, details } = computeScore();
  const scoreColor = SCORE_COLOR(total);

  const updateCritOption = (critId, optIdx, field, value) =>
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === critId
          ? { ...c, options: c.options.map((o, i) => i === optIdx ? { ...o, [field]: field === "points" ? parseFloat(value) || 0 : value } : o) }
          : c
      )
    );

  const updateCritField = (critId, field, value) =>
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === critId
          ? { ...c, [field]: field.includes("Points") || field === "basePrice" ? parseFloat(value) || 0 : value }
          : c
      )
    );

  const updateConditionalBonus = (critId, value) =>
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === critId
          ? { ...c, conditionalPoints: { ...c.conditionalPoints, bonus: parseFloat(value) || 0 } }
          : c
      )
    );

  const updateThreshold = (critId, idx, value) =>
    setCriteria((prev) =>
      prev.map((c) => {
        if (c.id !== critId) return c;
        const updated = [...c.thresholds];
        updated[idx] = { ...updated[idx], points: parseFloat(value) || 0 };
        return { ...c, thresholds: updated };
      })
    );

  const removeCrit = (id) => setCriteria((p) => p.filter((c) => c.id !== id));

  const addCrit = () => {
    const id = "crit_" + Date.now();
    const base = { id, name: newCrit.name || "New Criterion", type: newCrit.type };
    if (newCrit.type === "boolean" || newCrit.type === "conditional_boolean")
      base.basePoints = parseFloat(newCrit.basePoints) || 1;
    if (newCrit.type === "select")
      base.options = [{ value: "yes", label: "Yes", points: 2 }, { value: "no", label: "No", points: 0 }];
    if (newCrit.type === "price") { base.basePrice = 40000; base.pointsPerThousand = -1; }
    setCriteria((p) => [...p, base]);
    setShowAddModal(false);
    setNewCrit({ name: "", type: "boolean", basePoints: 1 });
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-accent" />
        <div>
          <div className="header-title">Tesla Model X</div>
          <div className="header-subtitle">Purchase Evaluation Rubric</div>
        </div>
        <div className="header-score">
          <div className="header-score-value" style={{ color: scoreColor }}>{ptStr(total)}</div>
          <div className="header-score-label" style={{ color: scoreColor }}>{SCORE_LABEL(total)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        {["evaluate", "rubric"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "evaluate" ? "Evaluate Vehicle" : "Edit Rubric"}
          </button>
        ))}
      </div>

      <div className="content">
        {/* EVALUATE TAB */}
        {tab === "evaluate" && (
          <div>
            <p className="hint-text">Fill in what you know about the vehicle. Leave fields blank to skip them.</p>
            <div className="vin-hw-section">
              <span className="vin-hw-label">Estimate Autopilot hardware from VIN:</span>
              <input
                type="text"
                placeholder="e.g. 7SAXCAE55PF374926"
                value={vinForHw}
                onChange={(e) => setVinForHw(e.target.value.toUpperCase().slice(0, 17))}
                className="vin-hw-input"
                maxLength={17}
              />
              {hwEstimate && (
                <>
                  <span className="vin-hw-estimate">
                    → {hwEstimate.label} ({hwEstimate.model === "Model X" ? "Model X " : ""}{hwEstimate.year}
                    {hwEstimate.note ? `; ${hwEstimate.note}` : ""})
                  </span>
                  <button type="button" className="btn btn-sm btn-primary" onClick={applyHwEstimate}>
                    Apply to Autopilot Hardware
                  </button>
                </>
              )}
            </div>
            {criteria.map((c) => (
              <div key={c.id} className="eval-row">
                <div className="eval-label">
                  {c.name}
                  {c.note && <span className="eval-label-note">({c.note})</span>}
                </div>
                <div className="eval-input">
                  {c.type === "select" && (
                    <select value={selections[c.id] || ""} onChange={(e) => setSelection(c.id, e.target.value)}>
                      <option value="">— skip —</option>
                      {c.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label} ({ptStr(o.points)} pts)</option>
                      ))}
                    </select>
                  )}
                  {(c.type === "boolean" || c.type === "conditional_boolean") && (
                    <div className="bool-group">
                      {["", true, false].map((v, i) => {
                        const label = i === 0 ? "Skip" : v ? "Yes" : "No";
                        const active = selections[c.id] === v && v !== "";
                        return (
                          <button key={i} className="btn btn-sm" onClick={() => setSelection(c.id, v)}
                            style={{
                              background: active ? (v ? "#1a3a1a" : "#3a1a1a") : "#1e1e1e",
                              color: active ? (v ? "#22c55e" : "#ef4444") : "#666",
                              border: `1px solid ${active ? (v ? "#22c55e44" : "#ef444444") : "#2a2a2a"}`,
                            }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {c.type === "price" && (
                    <input type="number" placeholder="e.g. 45000" value={selections[c.id] || ""} onChange={(e) => setSelection(c.id, e.target.value)} />
                  )}
                  {c.type === "range_score" && (
                    <input type="number" placeholder="e.g. 35000" value={selections[c.id] || ""} onChange={(e) => setSelection(c.id, e.target.value)} />
                  )}
                </div>
              </div>
            ))}

            {details.length > 0 && (
              <div className="breakdown">
                <div className="breakdown-heading">Score Breakdown</div>
                {details.map((d, i) => {
                  const p = Math.round(d.points * 10) / 10;
                  return (
                    <div key={i} className="breakdown-row">
                      <span className="breakdown-name">{d.name} <span className="breakdown-detail">({d.label})</span></span>
                      <span className={`badge ${ptClass(p)}`}>{ptStr(p)}</span>
                    </div>
                  );
                })}
                <div className="breakdown-total">
                  <span>Total Score</span>
                  <span style={{ color: scoreColor }}>{ptStr(total)} — {SCORE_LABEL(total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RUBRIC TAB */}
        {tab === "rubric" && (
          <div>
            <div className="rubric-toolbar">
              <p className="hint-text" style={{ margin: 0 }}>Click any criterion to edit its point values.</p>
              <button className="btn btn-red btn-sm" onClick={() => setShowAddModal(true)}>+ Add Criterion</button>
            </div>
            {criteria.map((c) => (
              <div key={c.id} className="crit-card">
                <div className="crit-header">
                  <div>
                    {editingId === c.id
                      ? <input className="crit-name-input" value={c.name} onChange={(e) => updateCritField(c.id, "name", e.target.value)} />
                      : <div className="crit-name">{c.name}</div>
                    }
                    <div className="crit-type">{c.type.replace(/_/g, " ")}</div>
                  </div>
                  <div className="crit-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(editingId === c.id ? null : c.id)}>
                      {editingId === c.id ? "Done" : "Edit"}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeCrit(c.id)}>✕</button>
                  </div>
                </div>

                {editingId === c.id && (
                  <div className="crit-edit-body">
                    {c.type === "select" && c.options.map((o, i) => (
                      <div key={i} className="edit-row">
                        <input value={o.label} onChange={(e) => updateCritOption(c.id, i, "label", e.target.value)} style={{ flex: 1 }} />
                        <input type="number" value={o.points} onChange={(e) => updateCritOption(c.id, i, "points", e.target.value)} style={{ width: 80 }} />
                        <span className="edit-pts-label">pts</span>
                      </div>
                    ))}
                    {(c.type === "boolean" || c.type === "conditional_boolean") && (
                      <div className="edit-row">
                        <span className="edit-row-label">Points when Yes:</span>
                        <input type="number" value={c.basePoints} onChange={(e) => updateCritField(c.id, "basePoints", e.target.value)} style={{ width: 80 }} />
                        {c.type === "conditional_boolean" && c.conditionalPoints && (
                          <>
                            <span className="edit-row-label">Conditional bonus:</span>
                            <input type="number" value={c.conditionalPoints.bonus} onChange={(e) => updateConditionalBonus(c.id, e.target.value)} style={{ width: 80 }} />
                          </>
                        )}
                      </div>
                    )}
                    {c.type === "price" && (
                      <div className="edit-row" style={{ flexWrap: "wrap", gap: 12 }}>
                        <div className="edit-row">
                          <span className="edit-row-label">Base price $</span>
                          <input type="number" value={c.basePrice} onChange={(e) => updateCritField(c.id, "basePrice", e.target.value)} style={{ width: 100 }} />
                        </div>
                        <div className="edit-row">
                          <span className="edit-row-label">Pts per $1k over:</span>
                          <input type="number" value={c.pointsPerThousand} onChange={(e) => updateCritField(c.id, "pointsPerThousand", e.target.value)} style={{ width: 70 }} />
                        </div>
                      </div>
                    )}
                    {c.type === "range_score" && c.thresholds && (
                      <div>
                        {c.thresholds.filter((t) => t.max !== Infinity).map((t, i) => (
                          <div key={i} className="edit-row">
                            <span className="edit-threshold-label">≤ {t.max.toLocaleString()}</span>
                            <input type="number" value={t.points} onChange={(e) => updateThreshold(c.id, i, e.target.value)} style={{ width: 70 }} />
                            <span className="edit-pts-label">pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {editingId !== c.id && (
                  <div className="crit-badges">
                    {c.type === "select" && c.options.map((o) => (
                      <span key={o.value} className={`badge ${ptClass(o.points)}`}>{o.label}: {ptStr(o.points)}</span>
                    ))}
                    {c.type === "boolean" && (
                      <span className={`badge ${ptClass(c.basePoints)}`}>Yes: {ptStr(c.basePoints)}</span>
                    )}
                    {c.type === "conditional_boolean" && (
                      <>
                        <span className="badge pts-pos">Base: {ptStr(c.basePoints)}</span>
                        {c.conditionalPoints && (
                          <span className="badge pts-pos">Conditional bonus: +{c.conditionalPoints.bonus} (when {c.conditionalPoints.when}={c.conditionalPoints.equals})</span>
                        )}
                      </>
                    )}
                    {c.type === "price" && (
                      <span className="badge pts-neu">Base ${(c.basePrice || 0).toLocaleString()} · {c.pointsPerThousand} pt/$1k</span>
                    )}
                    {c.type === "range_score" && c.thresholds?.filter((t) => t.max !== Infinity).map((t, i) => (
                      <span key={i} className={`badge ${ptClass(t.points)}`}>≤{(t.max / 1000).toFixed(0)}k: {ptStr(t.points)}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-bg" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add New Criterion</div>
            <div className="modal-field">
              <label className="modal-label">NAME</label>
              <input value={newCrit.name} onChange={(e) => setNewCrit({ ...newCrit, name: e.target.value })} placeholder="e.g. Sunroof" />
            </div>
            <div className="modal-field">
              <label className="modal-label">TYPE</label>
              <select value={newCrit.type} onChange={(e) => setNewCrit({ ...newCrit, type: e.target.value })}>
                <option value="boolean">Yes/No (fixed points)</option>
                <option value="select">Multiple Options</option>
                <option value="price">Price (sliding scale)</option>
                <option value="range_score">Numeric Range (e.g. mileage)</option>
              </select>
            </div>
            {newCrit.type === "boolean" && (
              <div className="modal-field">
                <label className="modal-label">POINTS IF YES</label>
                <input type="number" value={newCrit.basePoints} onChange={(e) => setNewCrit({ ...newCrit, basePoints: e.target.value })} />
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-red" onClick={addCrit}>Add Criterion</button>
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}