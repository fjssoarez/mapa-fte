# Mapa FTE · instruções para o Claude

Site estático (HTML + CSS + JavaScript, sem build nem dependências) para registar ausências e horas de colaboradores de operações aeroportuárias e calcular o FTE ativo por local. Interface toda em **português de Portugal**.

- **Publicação:** GitHub Pages, ramo `main`, pasta raiz → https://fjssoarez.github.io/mapa-fte/
- **Dados e login:** Firebase (projeto `fte-b7dd7`): Authentication por email/palavra-passe + Firestore.
- **Dono:** Fábio Soares (fabio.soares@areas.com / fjsoarez@gmail.com). Não é programador: explica as coisas de forma simples e em português.

## Ficheiros

| Ficheiro | O quê |
|---|---|
| `index.html` | Estrutura da página: login, cabeçalho, separadores (Mapa mensal, Resumo, Quadro de pessoal, Acessos) |
| `app.js` | Toda a lógica: cálculo FTE, grelha (computador), lista + calendário (telemóvel), diálogos, quadro de pessoal, acessos |
| `store.js` | Camada de dados. Firebase se `config.js` tiver configuração; senão "modo local" (localStorage). A app só usa as funções deste objeto |
| `config.js` | Configuração Firebase, lista `ADMINS`, subtítulo `ORG` |
| `firestore.rules` | Regras de segurança do Firestore (**não** são publicadas pelo git — ver abaixo) |
| `styles.css` | Estilos. Telemóvel em `@media (max-width: 760px)` |

## Modelo de dados (Firestore)

- `meses/{AAAA-MM}` → `{ ym, staff: [{ k, n, nome, cc, cat, h, d, adm, sai }], example, updatedAt }` — quadro de pessoal do mês. `k` = chave única da pessoa, `h` = horas/semana, `d` = dias/semana, `cc` = local, `adm`/`sai` = datas ISO.
- `marcacoes/{AAAA-MM}_{k}` → `{ m: "AAAA-MM", k, cc, d: { "<dia>": { c?, at?, ex?, hn? } } }` — `c` = código de ausência (F, B, AT, L, FJ, FI, FO, LSV, D), `at` = horas de atraso, `ex` = horas extra, `hn` = horas noturnas.
- `acessos/{email em minúsculas}` → `{ role: "gerente" | "leitura" }`. Os responsáveis (admins) vêm de `ADMINS` em `config.js` **e** de `isAdmin()` em `firestore.rules`.

## Regras de cálculo (não alterar sem o Fábio pedir)

- FTE contratado = horas semanais ÷ 40 × (dias ativos no mês ÷ dias do mês).
- FTE ativo = contratado − (dias de ausência × horas/dia + horas de atraso) ÷ 173,33 (= 40 × 52 ÷ 12), nunca abaixo de 0.
- `D` (descanso), horas extra e horas noturnas são registados mas não alteram o FTE.

## Cuidados

- **Nunca** pôr dados reais de colaboradores (nomes, ficheiros do RH, exportações CSV) no repositório: é público. Os dados só existem no Firebase.
- A `apiKey` em `config.js` é pública por natureza; a segurança está em `firestore.rules`.
- Se mudar `ADMINS` em `config.js`, mudar também `isAdmin()` em `firestore.rules`, e vice-versa.
- **Se `firestore.rules` mudar**, o push não chega: avisar o Fábio para copiar o ficheiro inteiro para Firebase Console → Firestore Database → Regras → Publicar.
- Manter compatibilidade com dados já gravados (não renomear campos/coleções sem migração).
- Sem frameworks nem passos de build: o GitHub Pages serve os ficheiros tal como estão.
- Escrever código no estilo existente (funções curtas, nomes curtos, poucos comentários, textos da interface em pt-PT).

## Testar antes de publicar

- Pré-visualizar com a extensão **Live Server** (botão "Go Live" no fundo do VS Code) e abrir em **http://localhost:5500** — usar `localhost`, não `127.0.0.1` (o Firebase só autoriza `localhost`).
- Ver também em largura de telemóvel (F12 → ícone de telemóvel) e confirmar que não há erros na consola.
- Para testar sem tocar nos dados reais, pode-se pôr temporariamente `FIREBASE_CONFIG = null` em `config.js` (modo local) — **e repor antes do commit**.

## Publicar (commit + push)

O Fábio autoriza o Claude a fazer commit e push para `main` depois de cada alteração pedida, desde que:
1. a alteração tenha sido testada (pelo menos abrir a página sem erros),
2. `config.js` tenha a configuração Firebase verdadeira (não `null`),
3. a mensagem de commit seja curta e em português, a dizer o que mudou.

Depois do push, o site atualiza em 1–2 minutos. Dizer ao Fábio para recarregar a página (Ctrl+F5 no computador).
