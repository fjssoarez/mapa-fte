// Camada de dados: Firebase (partilhado) ou localStorage (modo local).
// A app só fala com estas funções, por isso troca-se de uma para a outra sem mexer no resto.
import { FIREBASE_CONFIG, ADMINS } from "./config.js";

const FBV = "https://www.gstatic.com/firebasejs/10.12.2/";
const admins = (ADMINS || []).map(e => String(e).trim().toLowerCase());

export const keySafe = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_\-.~:@+]/g, "-").replace(/^\.+$/, "x").slice(0, 80) || "x";
const markId = (ym, k) => ym + "_" + keySafe(k);

export async function createStore() {
  return FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey ? firebaseStore() : localStore();
}

// ---------------------------------------------------------------- local
function localStore() {
  let LS = null;
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); LS = localStorage; } catch (e) {}
  const mem = {};
  const subs = new Map();
  const emit = key => (subs.get(key) || []).forEach(fn => fn());
  const read = key => { try { const v = LS ? LS.getItem(key) : mem[key]; return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const write = (key, val) => {
    const s = val == null ? null : JSON.stringify(val);
    if (LS) { if (s == null) LS.removeItem(key); else LS.setItem(key, s); }
    else if (s == null) delete mem[key]; else mem[key] = s;
    emit(key);
  };
  const watch = (key, fn) => {
    let set = subs.get(key); if (!set) subs.set(key, set = new Set());
    set.add(fn); queueMicrotask(fn);
    return () => set.delete(fn);
  };
  addEventListener("storage", e => { if (e.key) emit(e.key); });
  const MK = ym => "fte.meses." + ym, KK = ym => "fte.marcacoes." + ym;

  return {
    mode: "local",
    onUser(cb) { queueMicrotask(() => cb({ email: "Modo local", role: "admin", locais: [], local: true })); },
    async signIn() {}, async signOut() {}, async resetPassword() {},
    watchMonth(ym, cb) { return watch(MK(ym), () => cb(read(MK(ym)))); },
    watchMarks(ym, cb) { return watch(KK(ym), () => cb(read(KK(ym)) || {})); },
    async getMonth(ym) { return read(MK(ym)); },
    async getMarks(ym) { return read(KK(ym)) || {}; },
    async setMonth(ym, data) { write(MK(ym), data); },
    async deleteMonth(ym) { write(KK(ym), null); write(MK(ym), null); },
    async setDays(ym, k, cc, changes) {
      const all = read(KK(ym)) || {}, rec = all[k] || { m: ym, k, d: {} };
      const d = Object.assign({}, rec.d);
      for (const day in changes) { if (changes[day] == null) delete d[day]; else d[day] = changes[day]; }
      all[k] = { m: ym, k, cc: cc || "", d }; write(KK(ym), all);
    },
    async setMarks(ym, recs) { const all = read(KK(ym)) || {}; for (const r of recs) all[r.k] = { m: ym, k: r.k, cc: r.cc || "", d: r.d || {} }; write(KK(ym), all); },
    watchAccess(cb) { cb([]); return () => {}; },
    async setAccess() {}, async deleteAccess() {}, async createUser() {}
  };
}

// ------------------------------------------------------------- firebase
async function firebaseStore() {
  const [appM, authM, fs] = await Promise.all([
    import(FBV + "firebase-app.js"), import(FBV + "firebase-auth.js"), import(FBV + "firebase-firestore.js")
  ]);
  const app = appM.initializeApp(FIREBASE_CONFIG);
  const auth = authM.getAuth(app);
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
  catch (e) { db = fs.getFirestore(app); }

  const marksQ = ym => fs.query(fs.collection(db, "marcacoes"), fs.where("m", "==", ym));
  // Gerentes com locais restritos só podem consultar os seus locais: uma consulta por local
  // (as regras do Firestore recusam consultas que possam devolver outros locais).
  const marksQs = (ym, locais) => locais && locais.length
    ? locais.map(cc => fs.query(fs.collection(db, "marcacoes"), fs.where("m", "==", ym), fs.where("cc", "==", cc)))
    : [marksQ(ym)];
  const toMap = snap => { const map = {}; snap.forEach(d => { const v = d.data(); if (v && v.k != null) map[v.k] = v; }); return map; };
  async function accessFor(email) {
    email = String(email || "").toLowerCase();
    if (admins.includes(email)) return { role: "admin", locais: [] };
    try {
      const s = await fs.getDoc(fs.doc(db, "acessos", email));
      if (!s.exists()) return { role: null, locais: [] };
      const v = s.data();
      return { role: v.role || "leitura", locais: Array.isArray(v.locais) ? v.locais : [] };
    } catch (e) { return { role: null, locais: [] }; }
  }
  async function commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = fs.writeBatch(db);
      ops.slice(i, i + 400).forEach(op => op(b));
      await b.commit();
    }
  }

  return {
    mode: "firebase",
    onUser(cb) { authM.onAuthStateChanged(auth, async u => cb(u ? Object.assign({ email: u.email }, await accessFor(u.email)) : null)); },
    signIn: (email, pw) => authM.signInWithEmailAndPassword(auth, email.trim(), pw),
    signOut: () => authM.signOut(auth),
    resetPassword: email => authM.sendPasswordResetEmail(auth, email.trim()),
    watchMonth(ym, cb, err) { return fs.onSnapshot(fs.doc(db, "meses", ym), s => cb(s.exists() ? s.data() : null), err); },
    watchMarks(ym, cb, err, locais) {
      const qs = marksQs(ym, locais), parts = new Array(qs.length);
      let ready = 0;
      const unsubs = qs.map((q, i) => fs.onSnapshot(q, snap => {
        if (parts[i] === undefined) ready++;
        parts[i] = toMap(snap);
        if (ready === qs.length) cb(Object.assign({}, ...parts));
      }, err));
      return () => unsubs.forEach(u => u());
    },
    async getMonth(ym) { const s = await fs.getDoc(fs.doc(db, "meses", ym)); return s.exists() ? s.data() : null; },
    async getMarks(ym, locais) { return Object.assign({}, ...(await Promise.all(marksQs(ym, locais).map(q => fs.getDocs(q)))).map(toMap)); },
    setMonth: (ym, data) => fs.setDoc(fs.doc(db, "meses", ym), data),
    async deleteMonth(ym) {
      const snap = await fs.getDocs(marksQ(ym));
      await commitInChunks(snap.docs.map(d => b => b.delete(d.ref)));
      await fs.deleteDoc(fs.doc(db, "meses", ym));
    },
    // Grava só os dias alterados (o resto do documento fica intacto), para dois gerentes
    // poderem mexer na mesma pessoa ao mesmo tempo sem apagarem o trabalho um do outro.
    setDays(ym, k, cc, changes) {
      const d = {}, fields = ["m", "k", "cc"];
      for (const day in changes) { d[day] = changes[day] == null ? fs.deleteField() : changes[day]; fields.push("d." + day); }
      return fs.setDoc(fs.doc(db, "marcacoes", markId(ym, k)), { m: ym, k, cc: cc || "", d }, { mergeFields: fields });
    },
    setMarks: (ym, recs) => commitInChunks(recs.map(r => b => b.set(fs.doc(db, "marcacoes", markId(ym, r.k)), { m: ym, k: r.k, cc: r.cc || "", d: r.d || {} }))),
    watchAccess(cb, err) { return fs.onSnapshot(fs.collection(db, "acessos"), snap => cb(snap.docs.map(d => Object.assign({ email: d.id }, d.data()))), err); },
    setAccess: (email, fields) => fs.setDoc(fs.doc(db, "acessos", email.trim().toLowerCase()), Object.assign({}, fields, { atualizadoEm: new Date().toISOString() }), { merge: true }),
    deleteAccess: email => fs.deleteDoc(fs.doc(db, "acessos", email)),
    // Cria a conta numa instância à parte, para a responsável não perder a própria sessão.
    async createUser(email, pw) {
      const sec = appM.initializeApp(FIREBASE_CONFIG, "sec-" + Date.now());
      try { const a2 = authM.getAuth(sec); await authM.createUserWithEmailAndPassword(a2, email.trim(), pw); await authM.signOut(a2); }
      finally { await appM.deleteApp(sec); }
    }
  };
}
