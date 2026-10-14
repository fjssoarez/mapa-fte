# Mapa FTE · Aeroportos

Site para registar ausências e horas dos colaboradores e calcular o FTE ativo por local. Funciona no computador e no telemóvel.

- **Site:** https://fjssoarez.github.io/mapa-fte/
- **Código:** https://github.com/fjssoarez/mapa-fte (GitHub Pages publica automaticamente o ramo `main`)
- **Dados e login:** Firebase, projeto `fte-b7dd7` → https://console.firebase.google.com (conta fjsoarez@gmail.com)
- **Responsáveis (acesso total):** fabio.soares@areas.com e fjsoarez@gmail.com

---

## Trabalhar no Visual Studio Code (no seu PC)

### Preparar o PC — uma vez só, ~15 min

1. **Instalar o Git:** https://git-scm.com/download/win → instalar com as opções que vêm marcadas.
2. **Instalar o VS Code:** https://code.visualstudio.com → instalar.
3. **Trazer o projeto para o PC:**
   - Abra o VS Code → `Ctrl+Shift+P` → escreva **Git: Clone** → Enter.
   - Cole `https://github.com/fjssoarez/mapa-fte` → escolha uma pasta (ex.: Documentos) → **Abrir**.
   - Se pedir, entre no GitHub com a conta **fjssoarez** (abre o navegador; autorize).
4. **Extensões:** o VS Code mostra “Este repositório recomenda extensões” → **Instalar**. São duas:
   - **Claude Code** — o assistente que faz as alterações.
   - **Live Server** — para ver o site no PC antes de publicar.
5. **Entrar no Claude:** clique no ícone do Claude (barra lateral ou canto superior direito) → entre com a sua conta Claude (precisa de um plano Claude Pro ou superior).
6. **Dizer ao Git quem é** (uma vez): no terminal do VS Code (`Ctrl+'`), escreva:
   ```
   git config --global user.name "Fábio Soares"
   git config --global user.email "fjsoarez@gmail.com"
   ```

### Rotina para cada alteração

1. Abra o VS Code (a pasta `mapa-fte` abre sozinha da última vez).
2. **Atualize primeiro:** peça ao Claude *“vai buscar a versão mais recente do GitHub”* (ou clique em ⟳ Sincronizar, no fundo).
3. **Peça a alteração ao Claude, em português**, por exemplo:
   - *“Acrescenta um código de ausência ‘C’ para Casamento, que conta como ausência.”*
   - *“No resumo, mostra também o total de horas noturnas por local.”*
   - *“Muda o subtítulo para ‘Operações Lisboa’.”*
4. **Veja antes de publicar:** clique em **Go Live** (no fundo do VS Code) → abre http://localhost:5500. Experimente no tamanho de telemóvel (F12 → ícone do telemóvel).
5. **Publique:** diga ao Claude *“está bom, publica”*. Ele faz o commit e o push; o site atualiza em 1–2 minutos (recarregue com `Ctrl+F5`).

O ficheiro `CLAUDE.md` explica o projeto ao Claude, por isso não precisa de lhe explicar tudo de cada vez.

### Atenção

- **Regras de segurança:** se o Claude alterar `firestore.rules`, isso **não** é publicado pelo push. Copie o ficheiro todo para Firebase → Firestore Database → **Regras** → **Publicar**.
- **Responsáveis:** para acrescentar outro responsável, peça ao Claude — ele muda `config.js` e `firestore.rules` (e depois publique as regras como acima).
- **Nunca** guarde ficheiros do RH ou exportações CSV dentro da pasta `mapa-fte`: o repositório é público.
- O Live Server tem de abrir em `localhost`, não em `127.0.0.1` (senão o login dá erro de domínio).
- Se algo correr mal depois de publicar, peça ao Claude *“desfaz a última alteração e publica”*.

---

## Usar o site

1. Entre com o seu email e palavra-passe.
2. **Quadro de pessoal:** cole a tabela do Excel do RH (com a linha de títulos) → Analisar → Importar. Nos meses seguintes use **Copiar quadro do mês anterior**.
3. **Acessos:** para cada gerente, escreva o email e uma palavra-passe provisória → *Dar acesso*. Envie-lhe o link do site. Ele pode trocar a palavra-passe em “Esqueci-me da palavra-passe”.
4. No telemóvel: abra o link no Chrome/Safari → menu → **Adicionar ao ecrã principal**.

### Permissões

| Quem | Vê | Marca ausências/horas | Quadro de pessoal | Acessos |
|---|---|---|---|---|
| Responsável (`config.js` + `firestore.rules`) | ✓ | ✓ | ✓ | ✓ |
| Gerente | ✓ | ✓ | – | – |
| Só consulta | ✓ | – | – | – |

### Cálculo

- **FTE contratado** = horas semanais ÷ 40, proporcional aos dias do mês em contrato.
- **FTE ativo** = FTE contratado − (dias de ausência × horas/dia + horas de atraso) ÷ 173,33.
- Descanso (D), horas extra e horas noturnas ficam registados mas não alteram o FTE.

### Privacidade

O código do site é público no GitHub, mas **os dados não estão no GitHub**: ficam no Firebase e só quem tem conta autorizada os consegue ler.
