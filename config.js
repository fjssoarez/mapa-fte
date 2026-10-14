// =====================================================================
//  CONFIGURAÇÃO DO SITE
//  Enquanto FIREBASE_CONFIG estiver a null, o site funciona em
//  "modo local": os dados ficam só no navegador de quem o abre.
//  Para partilhar entre gerentes, siga o LEIAME.md e cole aqui o
//  bloco de configuração que o Firebase lhe dá.
// =====================================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDS46i9_WbkecLW2rcwuPvoeaK3jxHOHxA",
  authDomain: "fte-b7dd7.firebaseapp.com",
  projectId: "fte-b7dd7",
  storageBucket: "fte-b7dd7.firebasestorage.app",
  messagingSenderId: "685111266469",
  appId: "1:685111266469:web:8e857bbeb37f57d667114c"
};

// Emails com acesso total (carregar quadro de pessoal, gerir acessos).
// Tem de ser a mesma lista que está em firestore.rules.
export const ADMINS = ["fjsoarez@gmail.com", "fabio.soares@areas.com"];

// Subtítulo que aparece ao lado do logótipo.
export const ORG = "Operações aeroportuárias";

// Feriados municipais ou outros dias a marcar na grelha, além dos nacionais
// (que já são calculados automaticamente, incluindo Páscoa e Corpo de Deus).
// Formato "MM-DD". Exemplo: { data: "06-13", nome: "Santo António (Lisboa)" }
export const FERIADOS_EXTRA = [];
