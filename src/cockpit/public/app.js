// pigeon cockpit SPA — vanilla JS, four views, all real data from the /api/* endpoints.
const app = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function getJSON(u, opts) { const r = await fetch(u, opts); return r.json(); }

const views = {
  async ask() {
    app.innerHTML = `
      <div class="card">
        <h3>Ask the deliverability employee</h3>
        <p class="muted">Describe a symptom — pigeon matches it to one of the 19 battle-tested scenarios and returns diagnosis → resolution → prevention, cited to the brain.</p>
        <textarea id="q" rows="2" placeholder="e.g. transactional email started landing in Gmail spam despite a verified domain"></textarea>
        <button class="go" id="go">Diagnose</button>
        <pre id="out" style="margin-top:14px"></pre>
      </div>`;
    const run = async () => {
      const symptom = document.getElementById("q").value.trim();
      if (!symptom) return;
      document.getElementById("out").textContent = "diagnosing…";
      const { answer } = await getJSON("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom }) });
      document.getElementById("out").textContent = answer;
    };
    document.getElementById("go").onclick = run;
  },
  async brain() {
    const files = await getJSON("/api/brain");
    app.innerHTML = files.length
      ? files.map((f) => `<div class="card"><h3>${esc(f.name)}</h3><pre>${esc(f.content.slice(0, 4000))}${f.content.length > 4000 ? "\n…" : ""}</pre></div>`).join("")
      : `<p class="muted">No brain/ files found.</p>`;
  },
  async runs() {
    const rows = await getJSON("/api/runs");
    app.innerHTML = `<div class="card"><h3>Run log <span class="badge">${rows.length}</span></h3>${
      rows.length ? rows.slice().reverse().map((r) => `<div class="row"><span class="badge">${esc(r.verb || "?")}</span><span class="${r.outcome === "ok" ? "pass" : "fail"}">${esc(r.outcome || "")}</span><span class="muted">${esc(r.ms ?? "")}ms</span><span class="muted">${esc(r.model || "")}</span></div>`).join("") : `<p class="muted">logs/runs.jsonl is empty — run a CLI verb to populate it.</p>`
    }</div>`;
  },
  async evals() {
    const tasks = await getJSON("/api/evals");
    app.innerHTML = `<div class="card"><h3>Eval scores <span class="badge">${tasks.length} golden tasks</span></h3>
      <p class="muted">Run <code>npm run eval</code> for the live L1/L2 pass/fail (F1 gate 0.80). Golden set:</p>
      ${tasks.map((t) => `<div class="row"><span class="badge">${esc(t.id || "")}</span><span class="badge">${esc(t.scn || "")}</span><span>${esc((t.symptom || "").slice(0, 80))}</span></div>`).join("")}</div>`;
  },
};

function route(view) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  (views[view] || views.ask)();
}
document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => route(b.dataset.view)));
route("ask");
