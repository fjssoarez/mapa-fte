import { createStore, keySafe } from "./store.js";
import { ORG, FERIADOS_EXTRA } from "./config.js";

// ======================================================= constantes
const CODES = [
  { c: "F", name: "Férias" },
  { c: "B", name: "Baixa médica" },
  { c: "AT", name: "Acidente de trabalho" },
  { c: "L", name: "Licença parental", long: "Licença parental / gravidez de risco" },
  { c: "FJ", name: "Falta justificada" },
  { c: "FI", name: "Falta injustificada" },
  { c: "FO", name: "Formação" },
  { c: "LSV", name: "Licença sem vencimento" },
  { c: "D", name: "Descanso", notAus: true }
];
const CODESET = new Set(CODES.map(x => x.c));
const CODE = Object.fromEntries(CODES.map(x => [x.c, x]));
const HF = [
  { f: "at", sign: "−", name: "Atraso", hint: "Desconta no FTE" },
  { f: "ex", sign: "+", name: "Horas extra", hint: "Fica registado, não mexe no FTE" },
  { f: "hn", sign: "N", name: "Horas noturnas", hint: "Fica registado, não mexe no FTE" }
];
const HFF = Object.fromEntries(HF.map(h => [h.f, h]));
const HSEM = 40, HMES = 40 * 52 / 12;
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const WDN = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const ROLE = { admin: "Responsável · acesso total", gerente: "Gerente · pode marcar", leitura: "Só consulta" };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v, d = 2) => Math.abs(v) < 1e-9 ? "–" : nf(v, d);
const hrs = v => (Number(v) || 0).toLocaleString("pt-PT", { maximumFractionDigits: 2 });
const pct = (a, b) => b ? (a / b * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 }) + "%" : "–";
const parseNum = v => { const x = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(x) ? x : NaN; };
const pad = n => String(n).padStart(2, "0");
const mobile = matchMedia("(max-width: 760px)");

// ======================================================= datas
const ymParts = ym => ym.split("-").map(Number);
const dim = ym => { const [y, m] = ymParts(ym); return new Date(y, m, 0).getDate(); };
const shiftYm = (ym, k) => { const [y, m] = ymParts(ym); const d = new Date(y, m - 1 + k, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
const iso = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
const ymLabel = ym => { const [y, m] = ymParts(ym); return MESES[m - 1] + " " + y; };
const todayIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const curYm = () => todayIso().slice(0, 7);
const wdOf = (ym, day) => { const [y, m] = ymParts(ym); return new Date(y, m - 1, day).getDay(); };
function activeRange(p, ym) {
  const [y, m] = ymParts(ym), n = dim(ym), first = iso(y, m, 1), last = iso(y, m, n);
  if (p.adm && p.adm > last) return null;
  if (p.sai && p.sai < first) return null;
  const a = p.adm && p.adm > first ? Number(p.adm.slice(8, 10)) : 1;
  const b = p.sai && p.sai < last ? Number(p.sai.slice(8, 10)) : n;
  return b >= a ? [a, b] : null;
}
// feriados nacionais (Portugal) + FERIADOS_EXTRA de config.js
const FIXOS = [["01-01", "Ano Novo"], ["04-25", "Dia da Liberdade"], ["05-01", "Dia do Trabalhador"], ["06-10", "Dia de Portugal"],
  ["08-15", "Assunção de Nossa Senhora"], ["10-05", "Implantação da República"], ["11-01", "Dia de Todos os Santos"],
  ["12-01", "Restauração da Independência"], ["12-08", "Imaculada Conceição"], ["12-25", "Natal"]];
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
const holCache = {};
function feriados(y) {
  if (holCache[y]) return holCache[y];
  const map = Object.fromEntries(FIXOS), e = easter(y);
  const add = (off, name) => { const d = new Date(e); d.setDate(d.getDate() + off); map[pad(d.getMonth() + 1) + "-" + pad(d.getDate())] = name; };
  add(-2, "Sexta-feira Santa"); add(0, "Páscoa"); add(60, "Corpo de Deus");
  for (const x of FERIADOS_EXTRA || []) if (x && x.data) map[x.data] = x.nome || "Feriado";
  return holCache[y] = map;
}
const feriado = (ym, day) => feriados(ymParts(ym)[0])[ym.slice(5) + "-" + pad(day)] || "";
function daysLabel(days) {
  const mn = MESES[ymParts(S.ym)[1] - 1].toLowerCase();
  if (days.length === 1) return `${WDN[wdOf(S.ym, days[0])]}, ${days[0]} de ${mn}`;
  return `${Math.min(...days)} a ${Math.max(...days)} de ${mn} · ${days.length} dias`;
}

// ======================================================= registos de um dia
// Cada dia guarda { c: código de ausência, at: h atraso, ex: h extra, hn: h noturnas }.
const isHN = v => typeof v === "string" && /^HN/.test(v);
function entry(v) {
  if (v == null || v === "") return null;
  if (typeof v === "object") return Object.assign({}, v);
  if (typeof v === "number") return v < 0 ? { at: -v } : v > 0 ? { ex: v } : null;
  if (isHN(v)) return { hn: parseNum(v.slice(2)) || 0 };
  if (CODESET.has(v)) return { c: v };
  return null;
}
const isEmpty = e => !e || (!e.c && !(+e.at) && !(+e.ex) && !(+e.hn));
function describe(e) {
  if (isEmpty(e)) return "";
  const out = [];
  if (e.c) out.push(CODE[e.c] ? CODE[e.c].name : e.c);
  for (const h of HF) if (+e[h.f]) out.push(h.name + " " + hrs(e[h.f]) + " h");
  return out.join(" · ");
}
function pills(e, max = 1) {
  if (isEmpty(e)) return "";
  const list = [];
  if (e.c) list.push(`<span class="pill k-${esc(e.c)}">${esc(e.c)}</span>`);
  for (const h of HF) if (+e[h.f]) list.push(`<span class="pill k-${h.f}">${h.sign}${hrs(e[h.f])}</span>`);
  return list.slice(0, max).join("") + (list.length > max ? '<i class="more" aria-hidden="true"></i>' : "");
}
const csvDay = e => isEmpty(e) ? "" : [e.c || "", +e.at ? "-" + e.at : "", +e.ex ? "+" + e.ex : "", +e.hn ? "HN" + e.hn : ""].filter(Boolean).join(" ").replace(/\./g, ",");

// ======================================================= cálculo FTE
function stats(p, ym, marks) {
  const n = dim(ym), r = activeRange(p, ym), h = Number(p.h) || 0, dw = Number(p.d) || 5;
  const contr = r ? (h / HSEM) * (r[1] - r[0] + 1) / n : 0;
  const counts = Object.fromEntries(CODES.map(x => [x.c, 0]));
  let dAus = 0, at = 0, ex = 0, hn = 0;
  const d = (marks[p.k] && marks[p.k].d) || {};
  if (r) for (const key in d) {
    const day = Number(key); if (day < r[0] || day > r[1]) continue;
    const e = entry(d[key]); if (!e) continue;
    if (e.c && CODESET.has(e.c)) { counts[e.c]++; if (!CODE[e.c].notAus) dAus++; }
    at += +e.at || 0; ex += +e.ex || 0; hn += +e.hn || 0;
  }
  const hd = h / dw, raw = (dAus * hd + at) / HMES, aus = Math.min(contr, raw), sc = raw ? aus / raw : 0;
  const ausBy = Object.fromEntries(CODES.map(x => [x.c, x.notAus ? 0 : counts[x.c] * hd / HMES * sc]));
  ausBy.at = at / HMES * sc;
  return { contr, counts, dAus, at, ex, hn, aus, ausBy, ef: contr - aus, active: !!r };
}
function blank() {
  return { n: 0, part: 0, contr: 0, ef: 0, aus: 0, at: 0, ex: 0, hn: 0, dAus: 0,
    counts: Object.fromEntries(CODES.map(x => [x.c, 0])), ausBy: Object.fromEntries(CODES.map(x => [x.c, 0]).concat([["at", 0]])) };
}
function addTo(t, st, p) {
  if (st.active) { t.n++; if ((Number(p.h) || 0) < HSEM) t.part++; }
  for (const f of ["contr", "ef", "aus", "at", "ex", "hn", "dAus"]) t[f] += st[f];
  for (const c in st.counts) t.counts[c] += st.counts[c];
  for (const c in st.ausBy) t.ausBy[c] += st.ausBy[c];
  return t;
}
function aggregate(staff, ym, marks) {
  const by = {}, T = blank();
  for (const p of staff) {
    const st = stats(p, ym, marks), key = p.cc || "(sem local)";
    addTo(by[key] || (by[key] = blank()), st, p); addTo(T, st, p);
  }
  return { by, T };
}

// ======================================================= estado
const S = {
  ym: curYm(), staff: null, example: false, marks: {}, cc: "", q: "", tab: "mapa",
  store: null, user: null, started: null, unsub: [],
  pending: {}, inflight: {}, timers: {}, lastSaved: null, saveErr: false, needRender: false,
  parsed: null, editStaff: null, dirtyStaff: false, access: [], unsubAccess: null
};
try { S.tab = localStorage.getItem("fte.tab") || "mapa"; S.cc = localStorage.getItem("fte.cc") || ""; } catch (e) {}
const canWrite = () => !!S.user && (S.user.role === "admin" || S.user.role === "gerente");
const canAdmin = () => !!S.user && S.user.role === "admin";
// Locais a que o utilizador está limitado (null = todos)
const mine = () => S.user && S.user.role !== "admin" && S.user.locais && S.user.locais.length ? S.user.locais : null;
const inScope = p => (!mine() || mine().includes(p.cc)) && (!S.cc || p.cc === S.cc);
function visibleStaff(useQ = true) {
  if (!S.staff) return [];
  const q = useQ ? S.q.trim().toLowerCase() : "";
  return S.staff.filter(p => inScope(p) && (!q || (p.nome || "").toLowerCase().includes(q) || String(p.n || "").toLowerCase().includes(q)));
}
const staffBy = k => (S.staff || []).find(p => p.k === k);
const marksD = k => (S.marks[k] && S.marks[k].d) || {};

// ======================================================= utilidades UI
let toastT;
function toast(t) {
  const el = $("toast"); el.textContent = t; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2800);
}
function errMsg(e) {
  const c = (e && (e.code || e.name)) || "";
  if (c.includes("permission-denied")) return "Sem permissão para esta alteração.";
  if (c.includes("unavailable") || c.includes("network")) return "Sem ligação à internet. Tente de novo.";
  if (c.includes("Quota")) return "O navegador ficou sem espaço para guardar.";
  return "Ocorreu um erro" + (c ? " (" + c + ")" : "") + ".";
}
function setMsg(id, cls, text) { const el = $(id); el.className = "msg " + (cls || ""); el.textContent = text || ""; }
function show(id) { for (const x of ["boot", "login", "noaccess", "main"]) $(x).hidden = x !== id; }

// diálogo único, reutilizado para pessoa / marcação / novo registo
const dlg = $("dlg");
let D = {};
function openDlg(html, handlers) {
  dlg.innerHTML = html; D = handlers || {};
  if (!dlg.open) dlg.showModal();
  const f = dlg.querySelector("[autofocus]"); if (f) f.focus();
}
function closeDlg() { if (dlg.open) dlg.close(); }
dlg.addEventListener("click", e => {
  if (e.target === dlg) return closeDlg();
  const b = e.target.closest("[data-act]");
  if (b && !b.disabled && D.act) D.act(b.dataset.act, b, e);
});
dlg.addEventListener("input", e => { if (D.input) D.input(e); });
dlg.addEventListener("change", e => { if (D.input) D.input(e); });
dlg.addEventListener("close", () => {
  document.querySelectorAll("td.sel").forEach(td => td.classList.remove("sel"));
  D = {};
  if (S.needRender) { S.needRender = false; renderView(); }
});

// ======================================================= gravação
function setSave() {
  const el = $("save"), busy = Object.values(S.pending).some(Boolean) || Object.values(S.inflight).some(Boolean);
  let cls = "", txt;
  if (S.saveErr) { cls = "err"; txt = "Erro ao guardar"; }
  else if (busy) { cls = "saving"; txt = "A guardar…"; }
  else if (S.lastSaved) txt = (S.store && S.store.mode === "local" ? "Guardado neste navegador às " : "Guardado às ") + pad(S.lastSaved.getHours()) + ":" + pad(S.lastSaved.getMinutes());
  else txt = "Tudo guardado";
  el.className = "save " + cls; el.lastElementChild.textContent = txt; el.title = txt;
}
// Alterações por gravar, por "mês|pessoa": só os dias mexidos (null = apagar o dia).
const pkey = (ym, k) => ym + "|" + k;
function queueSave(k, changes) {
  const rec = S.marks[k], key = pkey(rec.m, k);
  const job = S.pending[key] || (S.pending[key] = { m: rec.m, k, cc: rec.cc, days: {} });
  Object.assign(job.days, changes); job.cc = rec.cc;
  clearTimeout(S.timers[key]);
  S.timers[key] = setTimeout(() => flush(key), 400);
  setSave();
}
async function flush(key) {
  if (S.inflight[key]) return;
  S.inflight[key] = true; setSave();
  try {
    while (S.pending[key]) {
      const job = S.pending[key]; S.pending[key] = null;
      await S.store.setDays(job.m, job.k, job.cc, job.days);
    }
    S.lastSaved = new Date(); S.saveErr = false;
  } catch (e) { S.saveErr = true; toast("Não foi possível guardar: " + errMsg(e)); }
  finally { S.inflight[key] = false; setSave(); }
}
addEventListener("beforeunload", e => {
  if (Object.values(S.pending).some(Boolean) || Object.values(S.inflight).some(Boolean)) { e.preventDefault(); e.returnValue = ""; }
});

function applyDays(k, days, fn) {
  const p = staffBy(k);
  const rec = S.marks[k] || { m: S.ym, k, cc: p ? p.cc : "", d: {} };
  const d = Object.assign({}, rec.d), changes = {};
  for (const day of days) {
    const v = fn(entry(d[day]));
    if (isEmpty(v)) { delete d[day]; changes[day] = null; } else { d[day] = v; changes[day] = v; }
  }
  S.marks[k] = { m: S.ym, k, cc: p ? p.cc || "" : "", d };
  queueSave(k, changes);
  renderView();
}

// ======================================================= arranque e login
document.querySelectorAll(".org").forEach(el => el.textContent = ORG);
(async () => {
  try { S.store = await createStore(); }
  catch (e) { $("boot").innerHTML = '<div class="login-card"><h1>Não abriu</h1><p class="muted">Não foi possível carregar o Firebase. Verifique a ligação à internet e o ficheiro config.js.</p></div>'; return; }
  S.store.onUser(u => { S.user = u; route(); });
})();
function route() {
  const u = S.user;
  if (!u) { S.started = null; stopSubs(); show("login"); return; }
  if (!u.role) { $("naemail").textContent = u.email; show("noaccess"); return; }
  show("main");
  $("usrinit").textContent = (u.local ? "L" : (u.email || "?")[0]);
  $("usremail").textContent = u.email;
  $("usrrole").textContent = u.local ? "Os dados ficam só neste navegador" : (ROLE[u.role] || u.role) + (mine() ? " · " + mine().join(", ") : "");
  $("logout").hidden = !!u.local;
  document.querySelectorAll("[data-admin]").forEach(b => b.hidden = !canAdmin() || (b.hasAttribute("data-fb") && S.store.mode !== "firebase"));
  const allowed = [...document.querySelectorAll(".tabs button")].filter(b => !b.hidden).map(b => b.dataset.tab);
  if (!allowed.includes(S.tab)) S.tab = "mapa";
  if (S.started !== u.email) { S.started = u.email; subscribe(); }
}
$("loginform").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("lemail").value.trim(), pw = $("lpass").value;
  if (!email || !pw) return setMsg("lmsg", "bad", "Escreva o email e a palavra-passe.");
  $("lbtn").disabled = true; setMsg("lmsg", "", "A entrar…");
  try { await S.store.signIn(email, pw); setMsg("lmsg", "", ""); $("lpass").value = ""; }
  catch (err) {
    const c = err.code || "";
    setMsg("lmsg", "bad",
      c.includes("too-many") ? "Demasiadas tentativas. Espere uns minutos." :
      c.includes("network") ? "Sem ligação à internet." :
      c.includes("configuration-not-found") ? "O Authentication ainda não foi ativado no Firebase (Authentication → Começar)." :
      c.includes("operation-not-allowed") ? "O login por email e palavra-passe não está ativado no Firebase (Authentication → Sign-in method)." :
      c.includes("unauthorized-domain") ? "Este endereço não está autorizado no Firebase (Authentication → Settings → Authorized domains)." :
      c.includes("invalid-email") ? "O email não é válido." :
      /invalid-credential|wrong-password|user-not-found|invalid-login/.test(c) ? "Email ou palavra-passe errados." :
      "Não foi possível entrar (" + (c || err.message) + ").");
  } finally { $("lbtn").disabled = false; }
});
$("forgot").addEventListener("click", async () => {
  const email = $("lemail").value.trim();
  if (!email) { setMsg("lmsg", "warn", "Escreva primeiro o seu email no campo acima."); $("lemail").focus(); return; }
  try { await S.store.resetPassword(email); setMsg("lmsg", "ok", "Se a conta existir, vai receber um email para criar uma nova palavra-passe."); }
  catch (e) { setMsg("lmsg", "bad", "Não foi possível enviar o email. Confirme o endereço."); }
});
$("logout").addEventListener("click", () => S.store.signOut());
$("nalogout").addEventListener("click", () => S.store.signOut());

// ======================================================= subscrições
function stopSubs() { S.unsub.forEach(f => { try { f(); } catch (e) {} }); S.unsub = []; if (S.unsubAccess) { S.unsubAccess(); S.unsubAccess = null; } }
function onSubErr(e) { toast("Ligação interrompida: " + errMsg(e)); }
function subscribe() {
  S.unsub.forEach(f => { try { f(); } catch (e) {} }); S.unsub = [];
  S.staff = null; S.marks = {}; S.example = false; S.editStaff = null; S.dirtyStaff = false;
  renderAll();
  const ym = S.ym;
  S.unsub.push(S.store.watchMonth(ym, data => {
    if (ym !== S.ym) return;
    S.staff = data && Array.isArray(data.staff)
      ? data.staff.slice().sort((a, b) => (a.cc || "").localeCompare(b.cc || "", "pt") || (a.nome || "").localeCompare(b.nome || "", "pt")) : [];
    S.example = !!(data && data.example);
    if (!S.dirtyStaff) S.editStaff = null;
    fillCC(); renderAll();
  }, onSubErr));
  S.unsub.push(S.store.watchMarks(ym, map => {
    if (ym !== S.ym) return;
    for (const k in S.marks) if (S.pending[pkey(ym, k)] || S.inflight[pkey(ym, k)]) map[k] = S.marks[k];
    S.marks = map;
    if (drag || dlg.open) S.needRender = true; else renderView();
  }, onSubErr, mine()));
}
function fillCC() {
  const ccs = [...new Set((S.staff || []).map(p => p.cc).filter(c => c && (!mine() || mine().includes(c))))].sort((a, b) => a.localeCompare(b, "pt"));
  if (mine() && S.cc && !mine().includes(S.cc)) S.cc = "";
  if (S.cc && !ccs.includes(S.cc)) ccs.push(S.cc);
  $("cc").innerHTML = '<option value="">Todos os locais</option>' + ccs.map(c => `<option${c === S.cc ? " selected" : ""}>${esc(c)}</option>`).join("");
}

// ======================================================= render geral
function renderAll() {
  $("mlabel").textContent = ymLabel(S.ym);
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === S.tab)));
  for (const t of ["mapa", "resumo", "quadro", "acessos"]) $("v-" + t).hidden = S.tab !== t;
  $("newrec").hidden = !(S.tab === "mapa" && canWrite() && S.staff && S.staff.length);
  renderBanner(); renderView(); setSave();
}
function renderBanner() {
  let h = "";
  if (S.store && S.store.mode === "local") h += '<div class="notice info"><b>Modo de teste.</b> Os dados ficam guardados só neste navegador. Para os gerentes partilharem o mesmo mapa, configure o Firebase (ver LEIAME.md).</div>';
  if (S.example) h += '<div class="notice"><b>Dados de exemplo.</b> Nomes e marcações fictícios para experimentar. Substitua pelo quadro do RH em Quadro de pessoal.</div>';
  if (S.user && S.user.role === "leitura") h += '<div class="notice info">Só consulta: o seu acesso não permite marcar.</div>';
  $("banner").innerHTML = h;
}
function renderView() {
  if (S.tab === "mapa") renderMapa();
  else if (S.tab === "resumo") renderResumo();
  else if (S.tab === "quadro") renderStaffEdit();
  else if (S.tab === "acessos") renderAcessos();
}

function kpisHtml(T) {
  return `<div class="kpis">
    <div class="kpi dark"><span>FTE ativo</span><b>${nf(T.ef)}</b><small>de ${nf(T.contr)} contratado</small></div>
    <div class="kpi"><span>Colaboradores</span><b>${T.n}</b><small>${T.part} a tempo parcial</small></div>
    <div class="kpi"><span>Taxa de ausência</span><b>${pct(T.aus, T.contr)}</b><small>${nf(T.aus)} FTE indisponível</small></div>
    <div class="kpi"><span>Horas adicionais</span><b>${nf(T.ex + T.hn, 1)} h</b><small>${nf(T.ex, 1)} extra · ${nf(T.hn, 1)} noturnas</small></div>
  </div>`;
}
function emptyMonthHtml() {
  return `<div class="card empty-card"><h3>Ainda não há quadro de pessoal para ${esc(ymLabel(S.ym))}</h3>` + (canAdmin()
    ? `<p>Carregue a lista de colaboradores do RH, copie a do mês anterior, ou experimente primeiro com dados fictícios.</p>
       <div class="row"><button class="btn primary" data-go="quadro">Carregar quadro do RH</button><button class="btn" data-run="copyprev">Copiar do mês anterior</button><button class="btn" data-run="example">Experimentar com dados de exemplo</button></div>`
    : `<p>Peça à responsável para carregar o quadro de pessoal deste mês.</p>`) + `</div>`;
}

// ======================================================= MAPA
function renderMapa() {
  const el = $("mapcontent");
  $("eyebrow").textContent = S.cc || "Todos os locais";
  $("mapsub").textContent = canWrite()
    ? (mobile.matches ? "Toque num colaborador para ver o mês e registar ausências e horas." : "Clique num dia para registar. Arraste para escolher vários dias seguidos. Guardado automaticamente.")
    : "Consulta das ausências e horas do mês.";
  if (S.staff === null) { el.innerHTML = '<div class="card empty">A carregar…</div>'; return; }
  if (!S.staff.length) { el.innerHTML = emptyMonthHtml(); return; }
  const list = visibleStaff();
  const { T } = aggregate(S.staff.filter(inScope), S.ym, S.marks);
  const legend = CODES.filter(x => !x.notAus).slice(0, 5).map(x => `<span><span class="pill k-${x.c}">${x.c}</span>${esc(x.name)}</span>`).join("") +
    '<span><span class="fer-key" aria-hidden="true"></span>Feriado</span>';
  const old = $("gridwrap"), sx = old ? old.scrollLeft : null, sy = old ? old.scrollTop : 0;
  el.innerHTML = kpisHtml(T) + `<div class="card"><div class="card-head"><div><h3>Equipa e marcações</h3><p>${list.length} ${list.length === 1 ? "colaborador visível" : "colaboradores visíveis"}</p></div><div class="legend">${legend}</div></div>` +
    (list.length ? (mobile.matches ? listHtml(list) : gridHtml(list)) : '<div class="empty">Ninguém corresponde à pesquisa.</div>') + "</div>";
  const gw = $("gridwrap");
  if (gw) {
    if (sx !== null) { gw.scrollLeft = sx; gw.scrollTop = sy; }
    else { const t = gw.querySelector("th.today"); if (t) gw.scrollLeft = Math.max(0, t.offsetLeft - 210 - 38 * 3); }
  }
}
function gridHtml(list) {
  const n = dim(S.ym), t = todayIso(), tday = t.slice(0, 7) === S.ym ? Number(t.slice(8)) : 0;
  let h = `<div class="gridwrap" id="gridwrap"><table class="grid${canWrite() ? "" : " ro"}"><thead><tr><th class="name">Colaborador</th>`;
  for (let d = 1; d <= n; d++) {
    const wd = wdOf(S.ym, d), fer = feriado(S.ym, d);
    h += `<th class="day${wd === 0 || wd === 6 ? " we" : ""}${fer ? " fer" : ""}${d === tday ? " today" : ""}"${fer ? ` title="Feriado: ${esc(fer)}"` : ""}><span>${fer ? "Fer" : WD[wd]}</span><b>${d}</b></th>`;
  }
  h += `<th class="fte">FTE ativo</th></tr></thead><tbody>`;
  let ef = 0, contr = 0;
  for (const p of list) {
    const r = activeRange(p, S.ym), st = stats(p, S.ym, S.marks), d = marksD(p.k);
    ef += st.ef; contr += st.contr;
    h += `<tr data-k="${esc(p.k)}"><th class="name" scope="row"><button data-person="${esc(p.k)}" title="Ver o mês de ${esc(p.nome)}"><b>${esc(p.nome)}</b><small>${hrs(p.h)} h · ${esc(p.cc || "sem local")}</small></button></th>`;
    for (let day = 1; day <= n; day++) {
      const wd = wdOf(S.ym, day), fer = feriado(S.ym, day), we = (wd === 0 || wd === 6 ? " we" : "") + (fer ? " fer" : "");
      if (!r || day < r[0] || day > r[1]) { h += `<td class="off${we}" title="Fora do período de contrato"></td>`; continue; }
      const e = entry(d[day]), tip = [fer && "Feriado: " + fer, describe(e)].filter(Boolean).join(" · ");
      h += `<td class="cell${we}" data-d="${day}"${tip ? ` title="${esc(tip)}"` : ""}>${pills(e)}</td>`;
    }
    h += `<td class="fte"><b>${nf(st.ef)}</b><small>de ${nf(st.contr)}</small></td></tr>`;
  }
  return h + `</tbody><tfoot><tr><th class="name">Total · ${list.length}</th><td colspan="${n}"></td><td class="fte"><b>${nf(ef)}</b><small>de ${nf(contr)}</small></td></tr></tfoot></table></div>`;
}
function listHtml(list) {
  let h = '<ul class="plist">', ef = 0;
  for (const p of list) {
    const st = stats(p, S.ym, S.marks), sum = [];
    ef += st.ef;
    for (const x of CODES) if (st.counts[x.c]) sum.push(`<span class="pill k-${x.c}">${x.c}</span>${st.counts[x.c]} d`);
    for (const f of HF) if (st[f.f]) sum.push(`<span class="pill k-${f.f}">${f.sign}</span>${hrs(st[f.f])} h`);
    h += `<li><button class="prow" data-person="${esc(p.k)}"><span class="pinfo"><b>${esc(p.nome)}</b><small>${hrs(p.h)} h · ${esc(p.cc || "sem local")}${st.active ? "" : " · fora do contrato"}</small>` +
      `<span class="psum">${sum.length ? sum.map(s => `<span>${s}</span>`).join("") : "<span>Sem registos</span>"}</span></span>` +
      `<span class="pfte"><b>${nf(st.ef)}</b><small>FTE</small></span><span class="chev" aria-hidden="true">›</span></button></li>`;
  }
  return h + `</ul><div class="ptotal"><span>Total · ${list.length}</span><span>${nf(ef)} FTE</span></div>`;
}

// interação na grelha: clique = 1 dia; arrastar (rato) = vários dias seguidos
let drag = null, lastPtr = "mouse";
const mc = $("mapcontent");
mc.addEventListener("pointerdown", e => {
  lastPtr = e.pointerType;
  const td = e.target.closest("td.cell");
  if (!td || e.pointerType !== "mouse" || e.button !== 0 || !canWrite()) return;
  e.preventDefault();
  drag = { k: td.parentElement.dataset.k, a: +td.dataset.d, b: +td.dataset.d, tr: td.parentElement };
  markSel();
});
mc.addEventListener("pointerover", e => {
  if (!drag) return;
  const td = e.target.closest("td.cell");
  if (!td || td.parentElement !== drag.tr) return;
  drag.b = +td.dataset.d; markSel();
});
addEventListener("pointerup", () => {
  if (!drag) return;
  const g = drag; drag = null;
  const lo = Math.min(g.a, g.b), hi = Math.max(g.a, g.b), days = [];
  g.tr.querySelectorAll("td.cell").forEach(td => { const d = +td.dataset.d; if (d >= lo && d <= hi) days.push(d); });
  if (days.length) openPicker(g.k, days); else if (S.needRender) { S.needRender = false; renderView(); }
});
function markSel() {
  const lo = Math.min(drag.a, drag.b), hi = Math.max(drag.a, drag.b);
  drag.tr.querySelectorAll("td.cell").forEach(td => { const d = +td.dataset.d; td.classList.toggle("sel", d >= lo && d <= hi); });
}
mc.addEventListener("click", e => {
  const pb = e.target.closest("[data-person]");
  if (pb) return openPerson(pb.dataset.person);
  if (lastPtr === "mouse") return;
  const td = e.target.closest("td.cell");
  if (!td) return;
  if (!canWrite()) return toast("Só consulta: não pode marcar.");
  td.classList.add("sel");
  openPicker(td.parentElement.dataset.k, [+td.dataset.d]);
});

// ---------- vista de uma pessoa (calendário do mês)
function openPerson(k) {
  const p = staffBy(k); if (!p) return;
  const [y, m] = ymParts(S.ym), n = dim(S.ym), r = activeRange(p, S.ym), st = stats(p, S.ym, S.marks), d = marksD(k);
  const t = todayIso(), lead = (new Date(y, m - 1, 1).getDay() + 6) % 7, cw = canWrite();
  let cal = ["S", "T", "Q", "Q", "S", "S", "D"].map(w => `<span class="cw">${w}</span>`).join("") + "<span></span>".repeat(lead);
  for (let day = 1; day <= n; day++) {
    const wd = wdOf(S.ym, day), on = r && day >= r[0] && day <= r[1], e = entry(d[day]), fer = feriado(S.ym, day);
    const tip = [fer && "Feriado: " + fer, describe(e)].filter(Boolean).join(" · ");
    cal += `<button type="button" class="cday${wd === 0 || wd === 6 ? " we" : ""}${fer ? " fer" : ""}${iso(y, m, day) === t ? " today" : ""}" data-act="day" data-d="${day}"${on && cw ? "" : " disabled"} aria-label="${day}${tip ? ": " + esc(tip) : ""}" title="${esc(tip)}"><b>${day}</b>${pills(e, 2)}</button>`;
  }
  const lines = [];
  for (const x of CODES) if (st.counts[x.c]) lines.push(`<span class="pill k-${x.c}">${x.c}</span> ${st.counts[x.c]} ${st.counts[x.c] === 1 ? "dia" : "dias"}`);
  openDlg(`<div class="sheet">
    <header class="sh-head"><div><b>${esc(p.nome)}</b><small>${hrs(p.h)} h/semana · ${esc(p.d)} dias · ${esc(p.cc || "sem local")} · ${esc(ymLabel(S.ym))}</small></div><button class="x" data-act="close" aria-label="Fechar">✕</button></header>
    <div class="sh-body">
      <div class="pstats"><div><span>FTE ativo</span><b>${nf(st.ef)}</b></div><div><span>Contratado</span><b>${nf(st.contr)}</b></div><div><span>Dias de ausência</span><b>${st.dAus}</b></div><div><span>Extra · Noturnas</span><b>${hrs(st.ex)} · ${hrs(st.hn)} h</b></div></div>
      ${lines.length ? `<p class="hint">${lines.join(" &nbsp; ")}${st.at ? ` &nbsp; <span class="pill k-at">−</span> ${hrs(st.at)} h atraso` : ""}</p>` : ""}
      ${cw ? '<p class="hint">Toque num dia para registar ou corrigir.</p>' : ""}
      <div class="cal">${cal}</div>
    </div>
    ${cw ? '<footer class="sh-foot"><button class="btn accent" data-act="period">+ Registar vários dias</button></footer>' : ""}
  </div>`, {
    act(a, b) {
      if (a === "close") closeDlg();
      if (a === "day") openPicker(k, [+b.dataset.d], () => openPerson(k));
      if (a === "period") openNovo(k, () => openPerson(k));
    }
  });
}

// ---------- escolher o que registar num ou mais dias
function openPicker(k, days, back) {
  const p = staffBy(k); if (!p || !canWrite()) return;
  const d = marksD(k), single = days.length === 1;
  const e0 = single ? (entry(d[days[0]]) || {}) : {};
  let code = single ? (e0.c || null) : undefined; // undefined = não mexer (vários dias)
  const codeBtns = CODES.map(x => `<button type="button" class="code" data-act="code" data-code="${x.c}" aria-pressed="${code === x.c}"><span class="pill k-${x.c}">${x.c}</span><span>${esc(x.name)}${x.notAus ? "<small>não conta como ausência</small>" : ""}</span></button>`).join("");
  const hRows = HF.map(h => `<div class="hrow"><span class="pill k-${h.f}">${h.sign}h</span><span class="t">${h.name}<small>${h.hint}</small></span>
    <span class="step"><button type="button" data-act="dec" data-f="${h.f}" aria-label="Menos">−</button><input id="h-${h.f}" type="number" inputmode="decimal" min="0" step="0.5" value="${single && +e0[h.f] ? e0[h.f] : ""}" placeholder="${single ? "0" : "—"}" aria-label="${h.name} (horas)"><button type="button" data-act="inc" data-f="${h.f}" aria-label="Mais">+</button></span></div>`).join("");
  const hasAny = days.some(day => !isEmpty(entry(d[day])));
  openDlg(`<div class="sheet">
    <header class="sh-head">${back ? '<button class="back" data-act="back" aria-label="Voltar">‹</button>' : ""}<div><b>${esc(p.nome)}</b><small>${esc(daysLabel(days))}</small></div><button class="x" data-act="close" aria-label="Fechar">✕</button></header>
    <div class="sh-body">
      <p class="lbl">Ausência ou descanso</p>
      ${single ? "" : '<p class="hint">Escolha um motivo para aplicar a todos os dias selecionados.</p>'}
      <div class="codes">${codeBtns}</div>
      <p class="lbl">Horas ${single ? "neste dia" : "por dia"}</p>
      <div class="hours">${hRows}</div>
    </div>
    <footer class="sh-foot">${hasAny ? '<button class="btn danger" data-act="clear">Limpar</button>' : ""}<span class="spacer"></span><button class="btn" data-act="${back ? "back" : "close"}">Cancelar</button><button class="btn primary" data-act="save">Guardar</button></footer>
  </div>`, {
    act(a, b) {
      if (a === "close") return closeDlg();
      if (a === "back") return back();
      if (a === "code") {
        code = code === b.dataset.code ? null : b.dataset.code;
        dlg.querySelectorAll(".code").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.code === code)));
      }
      if (a === "inc" || a === "dec") {
        const inp = $("h-" + b.dataset.f), v = parseNum(inp.value) || 0;
        inp.value = Math.max(0, v + (a === "inc" ? 0.5 : -0.5)) || "";
      }
      if (a === "clear") { applyDays(k, days, () => null); toast("Registo apagado."); return back ? back() : closeDlg(); }
      if (a === "save") {
        const vals = {};
        for (const h of HF) { const v = $("h-" + h.f).value.trim(); vals[h.f] = v === "" ? (single ? 0 : undefined) : Math.max(0, parseNum(v) || 0); }
        applyDays(k, days, old => {
          const e = Object.assign({}, old || {});
          if (code !== undefined) { if (code) e.c = code; else delete e.c; }
          for (const h of HF) { if (vals[h.f] === undefined) continue; if (vals[h.f] > 0) e[h.f] = vals[h.f]; else delete e[h.f]; }
          return e;
        });
        toast("Guardado.");
        return back ? back() : closeDlg();
      }
    }
  });
}

// ---------- novo registo (período)
function openNovo(k, back) {
  if (!canWrite()) return;
  const list = visibleStaff(false);
  if (!list.length) return toast("Não há colaboradores neste mês.");
  const [y, m] = ymParts(S.ym), n = dim(S.ym), first = iso(y, m, 1), last = iso(y, m, n), t = todayIso();
  const def = t >= first && t <= last ? t : first;
  const opts = list.map(p => `<option value="${esc(p.k)}"${p.k === k ? " selected" : ""}>${esc(p.nome)} · ${esc(p.cc || "sem local")}</option>`).join("");
  openDlg(`<div class="sheet">
    <header class="sh-head">${back ? '<button class="back" data-act="back" aria-label="Voltar">‹</button>' : ""}<div><b>Novo registo</b><small>${esc(ymLabel(S.ym))}</small></div><button class="x" data-act="close" aria-label="Fechar">✕</button></header>
    <div class="sh-body form">
      <label class="fld">Colaborador<select id="nr-k"${k ? "" : " autofocus"}>${k ? "" : '<option value="">Escolha…</option>'}${opts}</select></label>
      <label class="fld">O que aconteceu?<select id="nr-t">
        <optgroup label="Ausência ou descanso (dias)">${CODES.map(x => `<option value="${x.c}">${x.c} · ${esc(x.long || x.name)}</option>`).join("")}</optgroup>
        <optgroup label="Horas">${HF.map(h => `<option value="h:${h.f}">${h.name}</option>`).join("")}</optgroup></select></label>
      <div class="two"><label class="fld">De<input type="date" id="nr-a" min="${first}" max="${last}" value="${def}"></label><label class="fld">Até<input type="date" id="nr-b" min="${first}" max="${last}" value="${def}"></label></div>
      <label class="fld" id="nr-hw" hidden>Horas em cada dia<input id="nr-h" type="number" inputmode="decimal" min="0.25" step="0.25" value="1"></label>
      <label class="check"><input type="checkbox" id="nr-skip" checked> Não contar dias de descanso (D) nem feriados</label>
      <label class="check"><input type="checkbox" id="nr-wk"> Só dias úteis (segunda a sexta)</label>
      <p class="hint">Só dentro de ${esc(ymLabel(S.ym))}. Para outro mês, mude o mês no topo.</p>
      <p class="msg" id="nr-msg"></p>
    </div>
    <footer class="sh-foot"><span class="spacer"></span><button class="btn" data-act="${back ? "back" : "close"}">Cancelar</button><button class="btn primary" data-act="save">Guardar</button></footer>
  </div>`, {
    input(e) {
      if (e.target.id === "nr-t") { $("nr-hw").hidden = !e.target.value.startsWith("h:"); $("nr-skip").checked = e.target.value === "F"; }
      if (e.target.id === "nr-a" && $("nr-b").value < e.target.value) $("nr-b").value = e.target.value;
    },
    act(a) {
      if (a === "close") return closeDlg();
      if (a === "back") return back();
      if (a !== "save") return;
      const kk = $("nr-k").value, tp = $("nr-t").value, da = $("nr-a").value, db = $("nr-b").value, wk = $("nr-wk").checked, skip = $("nr-skip").checked;
      const msg = (c, t) => { const el = $("nr-msg"); el.className = "msg " + c; el.textContent = t; };
      if (!kk) return msg("bad", "Escolha o colaborador.");
      if (!da || !db || da < first || db > last) return msg("bad", "As datas têm de estar dentro de " + ymLabel(S.ym) + ".");
      if (db < da) return msg("bad", "A data final é anterior à inicial.");
      const p = staffBy(kk), r = activeRange(p, S.ym), dd = marksD(kk);
      const days = [];
      let skipped = 0;
      for (let day = +da.slice(8); day <= +db.slice(8); day++) {
        const wd = wdOf(S.ym, day), cur = entry(dd[day]);
        if (wk && (wd === 0 || wd === 6)) continue;
        if (!r || day < r[0] || day > r[1]) continue;
        if (skip && (feriado(S.ym, day) || (cur && cur.c === "D"))) { skipped++; continue; }
        days.push(day);
      }
      if (!days.length) return msg("bad", skipped ? "Todos esses dias são descanso ou feriado." : "Nenhum desses dias está dentro do contrato desta pessoa.");
      let what;
      if (tp.startsWith("h:")) {
        const f = tp.slice(2), v = parseNum($("nr-h").value);
        if (!(v > 0)) return msg("bad", "Indique as horas.");
        applyDays(kk, days, old => Object.assign({}, old || {}, { [f]: v }));
        what = HFF[f].name + " " + hrs(v) + " h";
      } else {
        applyDays(kk, days, old => Object.assign({}, old || {}, { c: tp }));
        what = CODE[tp].name;
      }
      toast(`${what} · ${days.length} ${days.length === 1 ? "dia" : "dias"} · ${p.nome}` + (skipped ? ` (${skipped} descanso/feriado não contado${skipped === 1 ? "" : "s"})` : ""));
      return back ? back() : closeDlg();
    }
  });
}
$("newrec").addEventListener("click", () => openNovo(""));

// ======================================================= RESUMO
function renderResumo() {
  const el = $("r-content");
  $("r-eyebrow").textContent = S.cc || "Todos os locais";
  if (S.staff === null) { el.innerHTML = '<div class="card empty">A carregar…</div>'; return; }
  const staff = S.staff.filter(inScope);
  if (!staff.length) { el.innerHTML = emptyMonthHtml(); return; }
  const { by, T } = aggregate(staff, S.ym, S.marks), keys = Object.keys(by).sort((a, b) => a.localeCompare(b, "pt"));
  const used = CODES.filter(x => keys.some(k => by[k].counts[x.c]));
  let t = `<thead><tr><th>Local</th><th>Colab.</th><th>FTE contr.</th>${used.map(x => `<th title="${esc(x.long || x.name)}">${x.c}</th>`).join("")}<th>Atraso h</th><th>Extra h</th><th>Noturnas h</th><th>FTE ativo</th><th>Taxa aus.</th></tr></thead><tbody>`;
  const row = (name, a, cls) => `<tr${cls ? ` class="${cls}"` : ""}><td>${esc(name)}</td><td>${a.n}</td><td>${nf(a.contr)}</td>${used.map(x => `<td>${a.counts[x.c] || "–"}</td>`).join("")}<td>${a.at ? hrs(a.at) : "–"}</td><td>${a.ex ? hrs(a.ex) : "–"}</td><td>${a.hn ? hrs(a.hn) : "–"}</td><td><b>${nf(a.ef)}</b></td><td>${pct(a.aus, a.contr)}</td></tr>`;
  keys.forEach(k => t += row(k, by[k]));
  t += row("Total", T, "total") + "</tbody>";
  const mot = CODES.filter(x => !x.notAus).map(x => ({ c: x.c, name: x.name, v: T.ausBy[x.c] })).concat([{ c: "at", name: "Atrasos", v: T.ausBy.at }]).filter(x => x.v > 1e-9).sort((a, b) => b.v - a.v);
  const max = Math.max(...mot.map(x => x.v), 1e-9);
  const bars = mot.length ? '<div class="bars">' + mot.map(x => `<div class="bar"><span class="lab"><span class="pill k-${x.c}">${x.c === "at" ? "−h" : x.c}</span>${esc(x.name)}</span><span class="track"><span class="fill" style="width:${(x.v / max * 100).toFixed(1)}%"></span></span><span class="val">${nf(x.v)} FTE</span></div>`).join("") + "</div>"
    : '<p class="muted">Sem ausências registadas neste mês.</p>';
  el.innerHTML = kpisHtml(T) + `<div class="two-col">
    <div class="card"><div class="card-head"><div><h3>Capacidade por local</h3><p>${esc(ymLabel(S.ym))}</p></div><button class="btn" id="export">Exportar para Excel</button></div><div class="tablewrap"><table class="sum">${t}</table></div></div>
    <div class="card"><div class="card-head"><div><h3>Indisponibilidade por motivo</h3><p>FTE perdido no mês</p></div></div><div class="card-pad">${bars}</div></div>
  </div>`;
}
$("r-content").addEventListener("click", e => { if (e.target.closest("#export")) exportCsv(); });
function exportCsv() {
  const n = dim(S.ym), sep = ";", num = v => (Math.round(v * 1000) / 1000).toString().replace(".", ",");
  const q = s => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const head = ["Nº", "Nome", "Local", "Horas sem.", "Dias sem.", "Admissão", "Saída"].concat(Array.from({ length: n }, (_, i) => String(i + 1)), CODES.map(x => x.c), ["Atraso h", "Extra h", "Noturnas h", "FTE contratado", "FTE ativo"]);
  const lines = [head.map(q).join(sep)];
  for (const p of (S.staff || []).filter(inScope)) {
    const st = stats(p, S.ym, S.marks), d = marksD(p.k);
    const days = Array.from({ length: n }, (_, i) => csvDay(entry(d[i + 1])));
    lines.push([p.n, p.nome, p.cc, num(Number(p.h) || 0), p.d, p.adm, p.sai].map(q).concat(days.map(q), CODES.map(x => st.counts[x.c]), [num(st.at), num(st.ex), num(st.hn), num(st.contr), num(st.ef)]).join(sep));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "FTE_" + S.ym + (S.cc ? "_" + keySafe(S.cc) : "") + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Ficheiro descarregado.");
}
$("loadyear").addEventListener("click", async () => {
  const y = ymParts(S.ym)[0];
  setMsg("yearmsg", "", "A ler os 12 meses…");
  try {
    const res = {}, all = new Set();
    for (let m = 1; m <= 12; m++) {
      const ym = y + "-" + pad(m), md = await S.store.getMonth(ym);
      if (!md) continue;
      const staff = (md.staff || []).filter(inScope), marks = await S.store.getMarks(ym, mine());
      res[m] = aggregate(staff, ym, marks).by; Object.keys(res[m]).forEach(k => all.add(k));
    }
    const keys = [...all].sort((a, b) => a.localeCompare(b, "pt"));
    if (!keys.length) { setMsg("yearmsg", "warn", "Nenhum mês de " + y + " tem quadro de pessoal."); $("sumyear").innerHTML = ""; return; }
    let h = "<thead><tr><th>Local</th>" + MS.map(s => `<th>${s}</th>`).join("") + "</tr></thead><tbody>";
    const tot = Array(13).fill(0);
    for (const k of keys) {
      h += `<tr><td>${esc(k)}</td>`;
      for (let m = 1; m <= 12; m++) { const v = res[m] && res[m][k] ? res[m][k].ef : null; if (v != null) tot[m] += v; h += `<td>${v == null ? "" : nf(v)}</td>`; }
      h += "</tr>";
    }
    h += '<tr class="total"><td>Total</td>' + MS.map((_, i) => `<td>${res[i + 1] ? nf(tot[i + 1]) : ""}</td>`).join("") + "</tr></tbody>";
    $("sumyear").innerHTML = h;
    setMsg("yearmsg", "ok", "FTE ativo de " + y + (S.cc ? " · " + S.cc : "") + ".");
  } catch (e) { setMsg("yearmsg", "bad", "Não foi possível ler o ano: " + errMsg(e)); }
});

// ======================================================= QUADRO DE PESSOAL
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[º°.]/g, "").replace(/\s+/g, " ").trim();
function parseDate(v) {
  v = String(v || "").trim(); if (!v) return "";
  let m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let y = Number(m[3]); if (y < 100) y += y > (new Date().getFullYear() % 100) + 5 ? 1900 : 2000; return iso(y, Number(m[2]), Number(m[1])); }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  if (/^\d{5}(\.\d+)?$/.test(v)) return new Date(Date.UTC(1899, 11, 30) + Number(v) * 864e5).toISOString().slice(0, 10);
  return "";
}
function parsePaste(text) {
  const rows = text.replace(/\r/g, "").split("\n").map(l => l.split("\t"));
  const hi = rows.findIndex(r => r.some(c => norm(c) === "nome"));
  if (hi < 0) return { error: "Não encontrei a linha de títulos (falta a coluna \"Nome\"). Copie a tabela incluindo os títulos." };
  const H = rows[hi].map(norm), find = (...names) => H.findIndex(h => names.includes(h));
  const ix = {
    n: find("n", "no", "numero", "n empregado", "no empregado", "n colaborador", "n mecanografico"),
    nome: find("nome"), cc: find("centro de custo", "centro custo", "local", "pdv", "loja"), cat: find("categoria"),
    adm: find("dt admissao", "data admissao", "admissao", "data de admissao"), sai: find("dt saida", "data saida", "dt demissao", "saida", "data de saida"),
    h: find("horas", "horas semanais", "horas sem", "horario"), d: find("dias", "dias semana", "dias por semana")
  };
  const out = [], warn = { noH: 0, noD: 0, noN: 0 }, seen = new Set();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i], nome = (r[ix.nome] || "").trim();
    if (!nome) continue;
    const n = ix.n >= 0 ? String(r[ix.n] || "").trim() : "";
    let h = ix.h >= 0 ? parseNum(r[ix.h]) : NaN, d = ix.d >= 0 ? parseNum(r[ix.d]) : NaN;
    if (!isFinite(h) || h <= 0) { h = 40; warn.noH++; }
    if (!isFinite(d) || d <= 0 || d > 7) { d = 5; warn.noD++; }
    if (!n) warn.noN++;
    let k = n ? keySafe(n) : "SN-" + keySafe(nome);
    while (seen.has(k)) k += "+";
    seen.add(k);
    out.push({ k, n, nome, cc: ix.cc >= 0 ? (r[ix.cc] || "").trim() : "", cat: ix.cat >= 0 ? (r[ix.cat] || "").trim() : "", h, d,
      adm: ix.adm >= 0 ? parseDate(r[ix.adm]) : "", sai: ix.sai >= 0 ? parseDate(r[ix.sai]) : "" });
  }
  return { staff: out, warn, missing: ["n", "cc", "h", "d", "adm"].filter(c => ix[c] < 0) };
}
$("parse").addEventListener("click", () => {
  const res = parsePaste($("paste").value);
  S.parsed = null; $("doimport").disabled = true; $("preview").innerHTML = "";
  if (res.error) return setMsg("pmsg", "bad", res.error);
  if (!res.staff.length) return setMsg("pmsg", "bad", "Não encontrei pessoas abaixo da linha de títulos.");
  S.parsed = res.staff; $("doimport").disabled = false;
  $("doimport").textContent = "Importar " + res.staff.length + " pessoas para " + ymLabel(S.ym);
  const names = { n: "Nº", cc: "Centro de custo", h: "Horas", d: "Dias", adm: "Dt admissão" }, w = [];
  if (res.missing.length) w.push("Colunas não encontradas: " + res.missing.map(c => names[c]).join(", ") + ".");
  if (res.warn.noH) w.push(res.warn.noH + " sem horas (assumido 40 h).");
  if (res.warn.noD) w.push(res.warn.noD + " sem dias por semana (assumido 5).");
  if (res.warn.noN) w.push(res.warn.noN + " sem nº (identificadas pelo nome).");
  setMsg("pmsg", w.length ? "warn" : "ok", res.staff.length + " pessoas encontradas. " + w.join(" "));
  const ccs = {}; res.staff.forEach(p => { const c = p.cc || "(sem local)"; (ccs[c] = ccs[c] || []).push(p); });
  $("preview").innerHTML = '<table class="sum"><thead><tr><th>Local</th><th>Pessoas</th><th>FTE contratual</th></tr></thead><tbody>' +
    Object.keys(ccs).sort().map(c => `<tr><td>${esc(c)}</td><td>${ccs[c].length}</td><td>${nf(ccs[c].reduce((s, p) => s + p.h / HSEM, 0))}</td></tr>`).join("") + "</tbody></table>";
});
const writeMonth = (staff, extra) => S.store.setMonth(S.ym, Object.assign({ ym: S.ym, staff, updatedAt: new Date().toISOString() }, extra || {}));
$("doimport").addEventListener("click", async () => {
  if (!S.parsed) return;
  $("doimport").disabled = true;
  try {
    await writeMonth(S.parsed, { example: false });
    setMsg("pmsg", "ok", "Quadro importado para " + ymLabel(S.ym) + ".");
    S.parsed = null; $("paste").value = ""; $("preview").innerHTML = "";
  } catch (e) { setMsg("pmsg", "bad", "Não foi possível importar: " + errMsg(e)); $("doimport").disabled = false; }
});

async function copyPrev() {
  const prevYm = shiftYm(S.ym, -1), prev = await S.store.getMonth(prevYm);
  if (!prev) throw new Error("O mês anterior (" + ymLabel(prevYm) + ") não tem quadro.");
  const [y, m] = ymParts(S.ym), first = iso(y, m, 1);
  const staff = (prev.staff || []).filter(p => !p.sai || p.sai >= first);
  await writeMonth(staff, { example: !!prev.example });
  return staff.length + " pessoas copiadas de " + ymLabel(prevYm) + " (sem quem já tinha saído).";
}
async function loadExample() {
  const first = ["Ana", "Bruno", "Carla", "Diogo", "Eva", "Filipe", "Gabriela", "Hugo", "Inês", "João", "Lara", "Miguel", "Nádia", "Óscar", "Paula", "Rui"];
  const last = ["Almeida", "Barros", "Coelho", "Duarte", "Esteves", "Faria", "Gomes", "Henriques", "Lopes", "Moura", "Neves", "Pires"];
  const ccs = ["Mercado", "Mercado", "Starbucks", "Starbucks", "Lojas", "Lojas", "Vending", "Vending"];
  const [y, m] = ymParts(S.ym), n = dim(S.ym);
  const staff = first.map((f, i) => ({ k: "EX-" + pad(i + 1), n: "EX-" + pad(i + 1), nome: f + " " + last[i % last.length], cc: ccs[i % 8], cat: "",
    h: [40, 20, 40, 40, 30, 40, 40, 24][i % 8], d: 5, adm: i === 14 ? iso(y, m, Math.min(15, n)) : "", sai: i === 15 ? iso(y, m, Math.min(20, n)) : "" }));
  await writeMonth(staff, { example: true });
  const sample = {
    "EX-01": { 3: { c: "F" }, 4: { c: "F" } }, "EX-03": { 8: { c: "B" } }, "EX-04": { 12: { at: 0.5 }, 13: { ex: 2 } }, "EX-05": { 15: { c: "FO" } },
    "EX-06": { 6: { hn: 3 }, 7: { hn: 2 }, 20: { c: "FJ" } }, "EX-09": { 10: { c: "F" }, 11: { c: "F" }, 12: { c: "F" }, 13: { c: "F" }, 14: { c: "F" } },
    "EX-11": { 1: { c: "D" }, 2: { c: "D" }, 22: { c: "AT" }, 23: { c: "AT" } }
  };
  await S.store.setMarks(S.ym, Object.keys(sample).map(k => ({ k, cc: staff.find(p => p.k === k).cc, d: sample[k] })));
  return "Exemplo carregado em " + ymLabel(S.ym) + ".";
}
document.addEventListener("click", async e => {
  const go = e.target.closest("[data-go]");
  if (go) { setTab(go.dataset.go); return; }
  const run = e.target.closest("[data-run]");
  if (!run || run.disabled) return;
  run.disabled = true;
  try { const t = await (run.dataset.run === "copyprev" ? copyPrev() : loadExample()); toast(t); if (S.tab === "quadro") setMsg("omsg", "ok", t); }
  catch (err) { const t = err.message && !err.code ? err.message : "Não foi possível: " + errMsg(err); toast(t); if (S.tab === "quadro") setMsg("omsg", "bad", t); }
  finally { run.disabled = false; }
});
function renderDel(confirming) {
  $("delwrap").innerHTML = confirming
    ? `<span class="confirm">Apagar o quadro e todas as marcações de ${esc(ymLabel(S.ym))}? <button class="btn danger" id="delyes">Sim, apagar</button><button class="btn" id="delno">Cancelar</button></span>`
    : '<button class="btn danger" id="delmonth">Apagar este mês</button>';
}
$("delwrap").addEventListener("click", async e => {
  if (e.target.id === "delmonth") renderDel(true);
  else if (e.target.id === "delno") renderDel(false);
  else if (e.target.id === "delyes") {
    try { await S.store.deleteMonth(S.ym); setMsg("omsg", "ok", ymLabel(S.ym) + " apagado."); }
    catch (err) { setMsg("omsg", "bad", "Não foi possível apagar: " + errMsg(err)); }
    renderDel(false);
  }
});

function renderStaffEdit() {
  if (S.staff === null) { $("staffedit").innerHTML = "<tbody><tr><td>A carregar…</td></tr></tbody>"; return; }
  if (!S.editStaff) S.editStaff = S.staff.map(p => Object.assign({}, p));
  $("savestaff").disabled = !S.dirtyStaff;
  if (!S.editStaff.length) { $("staffedit").innerHTML = "<tbody><tr><td>Sem pessoas neste mês. Cole o ficheiro do RH acima ou adicione uma pessoa.</td></tr></tbody>"; return; }
  const list = S.editStaff.filter(p => !S.cc || p.cc === S.cc || p._new);
  let h = "<thead><tr><th>Nº</th><th>Nome</th><th>Local</th><th>Horas sem.</th><th>Dias sem.</th><th>Admissão</th><th>Saída</th><th></th></tr></thead><tbody>";
  for (const p of list) {
    const i = S.editStaff.indexOf(p);
    h += `<tr data-i="${i}"><td><input data-f="n" value="${esc(p.n)}" aria-label="Nº" style="width:90px"></td><td><input data-f="nome" value="${esc(p.nome)}" aria-label="Nome" style="min-width:200px"></td><td><input data-f="cc" value="${esc(p.cc)}" aria-label="Local" list="cclist" style="min-width:150px"></td>` +
      `<td><input data-f="h" type="number" min="1" max="60" step="0.5" value="${esc(p.h)}" aria-label="Horas"></td><td><input data-f="d" type="number" min="1" max="7" value="${esc(p.d)}" aria-label="Dias"></td>` +
      `<td><input data-f="adm" type="date" value="${esc(p.adm)}" aria-label="Admissão"></td><td><input data-f="sai" type="date" value="${esc(p.sai)}" aria-label="Saída"></td><td><button class="btn small danger" data-rm="${i}" aria-label="Remover ${esc(p.nome)}">✕</button></td></tr>`;
  }
  const ccs = [...new Set(S.editStaff.map(p => p.cc).filter(Boolean))];
  $("staffedit").innerHTML = h + "</tbody>" + `<datalist id="cclist">${ccs.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`;
}
$("staffedit").addEventListener("input", e => {
  const tr = e.target.closest("tr[data-i]"); if (!tr) return;
  const p = S.editStaff[Number(tr.dataset.i)], f = e.target.dataset.f;
  p[f] = (f === "h" || f === "d") ? Number(e.target.value) : e.target.value;
  S.dirtyStaff = true; $("savestaff").disabled = false;
});
$("staffedit").addEventListener("click", e => {
  const rm = e.target.closest("[data-rm]"); if (!rm) return;
  S.editStaff.splice(Number(rm.dataset.rm), 1); S.dirtyStaff = true; renderStaffEdit();
});
$("addrow").addEventListener("click", () => {
  if (!S.editStaff) S.editStaff = [];
  S.editStaff.unshift({ k: "", n: "", nome: "", cc: S.cc || "", cat: "", h: 40, d: 5, adm: "", sai: "", _new: true });
  S.dirtyStaff = true; renderStaffEdit();
  const first = $("staffedit").querySelector("input[data-f=nome]"); if (first) first.focus();
});
$("savestaff").addEventListener("click", async () => {
  const seen = new Set(), out = [];
  for (const p of S.editStaff) {
    if (!String(p.nome || "").trim()) continue;
    const q = Object.assign({}, p); delete q._new;
    if (!q.k) q.k = q.n ? keySafe(q.n) : "SN-" + keySafe(q.nome);
    while (seen.has(q.k)) q.k += "+";
    seen.add(q.k); q.h = Number(q.h) || 40; q.d = Number(q.d) || 5; out.push(q);
  }
  try { await writeMonth(out, { example: S.example }); S.dirtyStaff = false; S.editStaff = null; setMsg("smsg", "ok", "Guardado."); renderStaffEdit(); }
  catch (e) { setMsg("smsg", "bad", "Não foi possível guardar: " + errMsg(e)); }
});

// ======================================================= ACESSOS
const knownLocais = () => [...new Set((S.staff || []).map(p => p.cc).concat(...S.access.map(a => a.locais || [])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
const chipsHtml = (name, sel) => {
  const all = knownLocais();
  return all.length ? all.map(c => `<label class="chip-check"><input type="checkbox" name="${name}" value="${esc(c)}"${sel.includes(c) ? " checked" : ""}>${esc(c)}</label>`).join("")
    : '<span class="muted">Ainda não há locais: carregue primeiro o quadro de pessoal deste mês.</span>';
};
const checkedIn = (root, name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
const locaisTxt = l => l && l.length ? l.join(", ") : "Todos";
function renderAcessos() {
  if (!S.unsubAccess) S.unsubAccess = S.store.watchAccess(list => { S.access = list; if (S.tab === "acessos") renderAccessList(); }, onSubErr);
  renderAccessList();
}
function renderAccessList() {
  const box = $("acc-locais"), keep = checkedIn(box, "acc-loc");
  box.innerHTML = chipsHtml("acc-loc", keep);
  const list = S.access.slice().sort((a, b) => a.email.localeCompare(b.email));
  $("acclist").innerHTML = '<thead><tr><th>Email</th><th>Pode…</th><th>Locais</th><th></th></tr></thead><tbody>' +
    `<tr><td>${esc(S.user.email)}</td><td>Acesso total (responsável)</td><td>Todos</td><td></td></tr>` +
    list.filter(a => a.email !== String(S.user.email).toLowerCase()).map(a => `<tr><td>${esc(a.email)}</td>` +
      `<td><select data-role="${esc(a.email)}" aria-label="Permissão de ${esc(a.email)}"><option value="gerente"${a.role === "gerente" ? " selected" : ""}>Marcar ausências e horas</option><option value="leitura"${a.role === "leitura" ? " selected" : ""}>Só consultar</option></select></td>` +
      `<td><button class="btn small" data-locais="${esc(a.email)}" title="Alterar locais">${esc(locaisTxt(a.locais))} ✎</button></td>` +
      `<td><button class="btn small danger" data-revoke="${esc(a.email)}">Retirar acesso</button></td></tr>`).join("") +
    "</tbody>";
}
function openLocais(email) {
  const a = S.access.find(x => x.email === email); if (!a) return;
  openDlg(`<div class="sheet">
    <header class="sh-head"><div><b>Locais de ${esc(email)}</b><small>Nenhum escolhido = vê todos os locais</small></div><button class="x" data-act="close" aria-label="Fechar">✕</button></header>
    <div class="sh-body"><div class="chips">${chipsHtml("dl-loc", a.locais || [])}</div></div>
    <footer class="sh-foot"><span class="spacer"></span><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="save">Guardar</button></footer>
  </div>`, {
    async act(act) {
      if (act === "close") return closeDlg();
      if (act !== "save") return;
      const locais = checkedIn(dlg, "dl-loc");
      try { await S.store.setAccess(email, { locais }); toast("Locais de " + email + ": " + locaisTxt(locais) + "."); closeDlg(); }
      catch (err) { toast(errMsg(err)); }
    }
  });
}
$("acclist").addEventListener("change", async e => {
  const s = e.target.closest("[data-role]"); if (!s) return;
  try { await S.store.setAccess(s.dataset.role, { role: s.value }); toast("Permissão atualizada."); } catch (err) { toast(errMsg(err)); }
});
$("acclist").addEventListener("click", async e => {
  const l = e.target.closest("[data-locais]"); if (l) return openLocais(l.dataset.locais);
  const b = e.target.closest("[data-revoke]"); if (!b) return;
  if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmar"; return; }
  try { await S.store.deleteAccess(b.dataset.revoke); toast("Acesso retirado."); } catch (err) { toast(errMsg(err)); }
});
$("acc-exists").addEventListener("change", e => { $("acc-pw").disabled = e.target.checked; });
$("accform").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("acc-email").value.trim().toLowerCase(), role = $("acc-role").value, pw = $("acc-pw").value, exists = $("acc-exists").checked;
  const locais = checkedIn($("acc-locais"), "acc-loc");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg("accmsg", "bad", "Email inválido.");
  if (!exists && pw.length < 6) return setMsg("accmsg", "bad", "A palavra-passe provisória precisa de pelo menos 6 caracteres.");
  setMsg("accmsg", "", "A criar…");
  try {
    let note = "";
    if (!exists) {
      try { await S.store.createUser(email, pw); }
      catch (err) { if (String(err.code).includes("email-already-in-use")) note = " A conta já existia: a palavra-passe não foi alterada."; else throw err; }
    }
    await S.store.setAccess(email, { role, locais });
    setMsg("accmsg", "ok", "Acesso dado a " + email + " (locais: " + locaisTxt(locais) + ")." + note + (exists || note ? "" : " Envie-lhe o link do site e a palavra-passe provisória."));
    $("acc-email").value = ""; $("acc-pw").value = "";
    $("acc-locais").querySelectorAll("input").forEach(i => i.checked = false);
  } catch (err) {
    const c = String(err.code || "");
    setMsg("accmsg", "bad", c.includes("weak-password") ? "Palavra-passe demasiado fraca." : c.includes("operation-not-allowed") ? "Ative o login por email/palavra-passe no Firebase (ver LEIAME)." : "Não foi possível: " + errMsg(err));
  }
});

// ======================================================= navegação
function setTab(t) { S.tab = t; try { localStorage.setItem("fte.tab", t); } catch (e) {} renderAll(); scrollTo(0, 0); }
document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab); });
$("prev").addEventListener("click", () => { S.ym = shiftYm(S.ym, -1); subscribe(); });
$("next").addEventListener("click", () => { S.ym = shiftYm(S.ym, 1); subscribe(); });
$("cc").addEventListener("change", e => {
  S.cc = e.target.value; try { localStorage.setItem("fte.cc", S.cc); } catch (err) {}
  if (!S.dirtyStaff) S.editStaff = null;
  renderAll();
});
let qt; $("q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value; renderView(); }, 150); });
mobile.addEventListener("change", () => { if (S.tab === "mapa") renderMapa(); });
document.addEventListener("click", e => { const u = $("usr"); if (u.open && !u.contains(e.target)) u.open = false; });
