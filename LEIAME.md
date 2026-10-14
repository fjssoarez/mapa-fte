# Mapa FTE · Aeroportos

Site para registar ausências e horas dos colaboradores e calcular o FTE ativo por local. Funciona no computador e no telemóvel.

- **Páginas:** GitHub Pages (gratuito)
- **Dados e login:** Firebase (gratuito, da Google)

Enquanto o Firebase não estiver configurado, o site funciona em **modo de teste**: tudo fica guardado só no navegador de quem o abre.

---

## Parte 1 — Firebase (dados partilhados e login), ~10 min

1. Vá a <https://console.firebase.google.com> e entre com a conta Google.
2. **Adicionar projeto** → nome `mapa-fte` → pode desativar o Google Analytics → Criar.
3. **Login:** menu *Build → Authentication* → *Começar* → separador *Sign-in method* → ative **Email/Password** → Guardar.
4. **Base de dados:** menu *Build → Firestore Database* → *Criar base de dados* → localização **europe-west** (ex.: `eur3`) → *Iniciar em modo de produção*.
5. **Regras de segurança:** ainda no Firestore, separador **Regras** → apague o que lá está → cole todo o conteúdo do ficheiro `firestore.rules` → **Publicar**.
   - Os emails da responsável estão na linha `isAdmin()`. Se quiser outro email, altere-o aqui **e** em `config.js`.
6. **Ligar o site ao Firebase:** ⚙️ *Definições do projeto* → em *As suas apps* clique no ícone **</>** (Web) → nome `mapa-fte` → *Registar app*. Aparece um bloco `const firebaseConfig = { apiKey: ..., ... }`.
   Abra `config.js` e troque `export const FIREBASE_CONFIG = null;` por:
   ```js
   export const FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   (Estes valores não são secretos; a proteção dos dados é feita pelas regras do passo 5.)
7. **Criar a sua conta:** *Authentication → Users → Add user* → o seu email (o mesmo de `config.js`) e uma palavra-passe.

## Parte 2 — Pôr o site no GitHub, ~5 min

1. Entre em <https://github.com> → **New repository** → nome `mapa-fte` → *Public* → Create.
2. Na página do repositório: **uploading an existing file** → arraste **todos os ficheiros desta pasta** (exceto a pasta `.git`, se a vir) → *Commit changes*.
3. *Settings → Pages* → *Source: Deploy from a branch* → Branch **main** / **(root)** → Save.
4. Passados 1–2 minutos o site fica em `https://<o-seu-utilizador>.github.io/mapa-fte/`.
5. De volta ao Firebase: *Authentication → Settings → Authorized domains* → **Add domain** → `<o-seu-utilizador>.github.io`.

## Parte 3 — Usar

1. Abra o site e entre com a sua conta.
2. **Quadro de pessoal:** cole a tabela do Excel do RH (com a linha de títulos) → Analisar → Importar. Nos meses seguintes use **Copiar quadro do mês anterior**.
3. **Acessos:** para cada gerente, escreva o email e uma palavra-passe provisória → *Dar acesso*. Envie-lhe o link do site. Ele pode trocar a palavra-passe em “Esqueci-me da palavra-passe”.
4. No telemóvel: abra o link no Chrome/Safari → menu → **Adicionar ao ecrã principal**. Fica com um ícone como uma app.

### Permissões

| Quem | Vê | Marca ausências/horas | Quadro de pessoal | Acessos |
|---|---|---|---|---|
| Responsável (email em `config.js` + `firestore.rules`) | ✓ | ✓ | ✓ | ✓ |
| Gerente | ✓ | ✓ | – | – |
| Só consulta | ✓ | – | – | – |

### Cálculo

- **FTE contratado** = horas semanais ÷ 40, proporcional aos dias do mês em contrato.
- **FTE ativo** = FTE contratado − (dias de ausência × horas/dia + horas de atraso) ÷ 173,33.
- Descanso (D), horas extra e horas noturnas ficam registados mas não alteram o FTE.

### Privacidade

O código do site é público no GitHub, mas **os dados não estão no GitHub**: ficam no Firebase e só quem tem conta autorizada os consegue ler. Não coloque ficheiros do RH na pasta do site.
