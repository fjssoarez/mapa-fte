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
    onUser(cb) { queueMicrotask(() => cb({ email: "Modo local", role: "admin", local: true })); },
    async signIn() {}, async signOut() {}, async resetPassword() {},
    watchMonth(ym, cb) { return watch(MK(ym), () => cb(read(MK(ym)))); },
    watchMarks(ym, cb) { return watch(KK(ym), () => cb(read(KK(ym)) || {})); },
    async getMonth(ym) { return read(MK(ym)); },
    async getMarks(ym) { return read(KK(ym)) || {}; },
    async setMonth(ym, data) { write(MK(ym), data); },
    async deleteMonth(ym) { write(KK(ym), null); write(MK(ym), null); },
    async setMark(ym, k, rec) { const all = read(KK(ym)) || {}; all[k] = { m: ym, k, cc: rec.cc || "", d: rec.d || {} }; write(KK(ym), all); },
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
  const toMap = snap => { const map = {}; snap.forEach(d => { const v = d.data(); if (v && v.k != null) map[v.k] = v; }); return map; };
  async function roleFor(email) {
    email = String(email || "").toLowerCase();
    if (admins.includes(email)) return "admin";
    try { const s = await fs.getDoc(fs.doc(db, "acessos", email)); return s.exists() ? (s.data().role || "leitura") : null; }
    catch (e) { return null; }
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
    onUser(cb) { authM.onAuthStateChanged(auth, async u => cb(u ? { email: u.email, role: await roleFor(u.email) } : null)); },
    signIn: (email, pw) => authM.signInWithEmailAndPassword(auth, email.trim(), pw),
    signOut: () => authM.signOut(auth),
    resetPassword: email => authM.sendPasswordResetEmail(auth, email.trim()),
    watchMonth(ym, cb, err) { return fs.onSnapshot(fs.doc(db, "meses", ym), s => cb(s.exists() ? s.data() : null), err); },
    watchMarks(ym, cb, err) { return fs.onSnapshot(marksQ(ym), snap => cb(toMap(snap)), err); },
    async getMonth(ym) { const s = await fs.getDoc(fs.doc(db, "meses", ym)); return s.exists() ? s.data() : null; },
    async getMarks(ym) { return toMap(await fs.getDocs(marksQ(ym))); },
    setMonth: (ym, data) => fs.setDoc(fs.doc(db, "meses", ym), data),
    async deleteMonth(ym) {
      const snap = await fs.getDocs(marksQ(ym));
      await commitInChunks(snap.docs.map(d => b => b.delete(d.ref)));
      await fs.deleteDoc(fs.doc(db, "meses", ym));
    },
    setMark: (ym, k, rec) => fs.setDoc(fs.doc(db, "marcacoes", markId(ym, k)), { m: ym, k, cc: rec.cc || "", d: rec.d || {} }),
    setMarks: (ym, recs) => commitInChunks(recs.map(r => b => b.set(fs.doc(db, "marcacoes", markId(ym, r.k)), { m: ym, k: r.k, cc: r.cc || "", d: r.d || {} }))),
    watchAccess(cb, err) { return fs.onSnapshot(fs.collection(db, "acessos"), snap => cb(snap.docs.map(d => Object.assign({ email: d.id }, d.data()))), err); },
    setAccess: (email, role) => fs.setDoc(fs.doc(db, "acessos", email.trim().toLowerCase()), { role, atualizadoEm: new Date().toISOString() }),
    deleteAccess: email => fs.deleteDoc(fs.doc(db, "acessos", email)),
    // Cria a conta numa instância à parte, para a responsável não perder a própria sessão.
    async createUser(email, pw) {
      const sec = appM.initializeApp(FIREBASE_CONFIG, "sec-" + Date.now());
      try { const a2 = authM.getAuth(sec); await authM.createUserWithEmailAndPassword(a2, email.trim(), pw); await authM.signOut(a2); }
      finally { await appM.deleteApp(sec); }
    }
  };
}
