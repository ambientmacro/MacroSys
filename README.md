
# MACRO AMBIENTAL — Sistema de Gestão de Frota

Sistema operacional de gestão de frota, motoristas e checklists construído com **React 19 + Vite 6 + Firebase**.

## Em desenvolvimento
### Equipe Contribuinte
- Arthur
- Ester
- Rikhelmy
- Yuri
---

## 🎯 Como rodar do ZERO (passo a passo blindado)

### 1️⃣ Instale as ferramentas (uma única vez)

| Ferramenta | Versão mínima | Onde baixar |
|---|---|---|
| **Node.js** | 18 LTS (recomendado **20 LTS**) | https://nodejs.org/en/download |
| **Git** | qualquer | https://git-scm.com/downloads |
| Editor (opcional) | — | https://code.visualstudio.com |

Confira que está instalado abrindo um **terminal novo** (PowerShell no Windows, Terminal no Mac/Linux):

```bash
node -v    # deve mostrar v20.x.x (ou v18.x.x)
npm -v     # deve mostrar 10.x.x (ou maior)
git --version
```

> ⚠️ **Se já tinha Node antigo instalado**, recomendo apagar e reinstalar do site oficial pra garantir versão atual.

### 2️⃣ Clone o repositório

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPO.git
cd SEU-REPO/frontend
```

### 3️⃣ Limpeza preventiva (importante se já tentou instalar antes)

Se você **já tentou rodar `npm install` antes e deu erro**, faça essa limpeza:

**Windows (PowerShell):**
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction Ignore
Remove-Item -Force package-lock.json -ErrorAction Ignore
npm cache clean --force
```

**Mac / Linux:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
```

### 4️⃣ Instale as dependências

```bash
npm install
```

> Se aparecer erro de **peer dependency** (`ERESOLVE`), rode com a flag:
> ```bash
> npm install --legacy-peer-deps
> ```
> Isso é seguro nesse projeto.




<!-- Arquivo de regra do firestore !!!
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{coll}/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && coll != "audit_backups";
    }
    match /audit_backups/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;   // qualquer usuário logado registra
      allow update, delete: if false;          // imutável
    }
  }
}
 -->






### 5️⃣ Confira o arquivo `.env`

O `.env` deve estar na raiz da pasta `frontend/` com este conteúdo:

# banco de adados conta *yuritakeo*
```env
VITE_FIREBASE_API_KEY=AIzaSyCKPYdy-1T6tYWmmRr2sYhv6ewlO-sCfqo
VITE_FIREBASE_AUTH_DOMAIN=testechecklistfrota.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=testechecklistfrota
VITE_FIREBASE_STORAGE_BUCKET=testechecklistfrota.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=862111407814
VITE_FIREBASE_APP_ID=1:862111407814:web:fbde6895f3e2abb529c1c7
VITE_FIREBASE_MEASUREMENT_ID=G-0DKN0BFCTB
```

# banco de adados conta *ambientmacro - gestao-frota*
```env
VITE_FIREBASE_API_KEY=AIzaSyCikw6eKgjuJVL-ja_aGniiwlK3eF3PGBM
VITE_FIREBASE_AUTH_DOMAIN=gestao-frota-9da3a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gestao-frota-9da3a
VITE_FIREBASE_STORAGE_BUCKET=gestao-frota-9da3a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=417897413988
VITE_FIREBASE_APP_ID=1:417897413988:web:f063242576aa2c4cccce71
VITE_FIREBASE_MEASUREMENT_ID=G-S0H02RS53D
```


# banco de adados conta *ambientmacro - novo-gestao-frota-teste*
```env
VITE_FIREBASE_API_KEY=AIzaSyAsnn_dWyxtmDhVWfCvDiDT8w1L5VCjzYs
VITE_FIREBASE_AUTH_DOMAIN=novo-gestao-frota-teste.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=novo-gestao-frota-teste
VITE_FIREBASE_STORAGE_BUCKET=novo-gestao-frota-teste.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1042386600420
VITE_FIREBASE_APP_ID=1:1042386600420:web:ff3a1c702bb843ebcd07f1
VITE_FIREBASE_MEASUREMENT_ID=G-TC0KW0YW23
```


Se não estiver, **crie o arquivo `.env`** na pasta `frontend/` (não em subpasta) com o conteúdo acima.

### 6️⃣ Autorize `localhost` no Firebase

1. Abra https://console.firebase.google.com
2. Selecione o projeto **<nome-do-projeto-firebase>** **testechecklistfrota (Conta yuritakeo)**
3. Menu lateral → **Authentication** → aba **Settings** → seção **Authorized domains**
4. Verifique se **`localhost`** está na lista. Se não estiver, clique em **Add domain** e adicione.

> Sem esse passo, o login local retorna erro de "unauthorized domain".

### 7️⃣ Rode o servidor de desenvolvimento

```bash
npm run dev
```

Vai abrir em **http://localhost:3000** com hot reload.

### 8️⃣ Logue no sistema

## 🔑 Credenciais

Falta colocar nas colunas os campos *obrigatórios*:
| Perfil | E-mail | Senha |
|---|---|---|
| TI / Admin (você) | `yuri@macro.local` | `yuri12345` |

Use o usuário abaixo para entrar e criar os demais usuários em **Menu → Usuários → Novo Usuário**.


---

# banco de adados conta *yuritakeo*
| Perfil | E-mail | Senha |
|---|---|---|
| TI / Admin (você) | `yuri@macro.local` | `yuri12345` |
| yuri seguranca / Segurança do Trabalho | `seguranca@macro.local` | `123456` |
| yuri frota / Administrador de Frota | `frota@macro.local` | `123456` |
| yuri encarregado / Encarregado | `encarregado@macro.local` | `123456` |
| yuri dp / Departamento Pessoal | `dp@macro.local` | `123456` |
| Yuri Motorista / Motorista | `yurimotmiyazaki@macro.local` | `123456` |


# banco de adados conta *ambientmacro*
| Perfil | E-mail | Senha |
|---|---|---|
| TI / Admin (você) | `ambientmacro@gmail.com` | `123456` |
| yuri Segurança Trabalho / Segurança do Trabalho | `yurisegurancatrabalho@eng.br` | `123456` |
| yuri Frota / Administrador de Frota | `yurifrota@eng.br` | `123456` |
| yuri Encarregado / Encarregado | `yuriencarregado@eng.br` | `123456` |
| yuri DP | `yuridp@emg.br` | `123456` |
| yuri Motorista / Motorista | `yurimotorista@eng.br` | `123456` |



# ========== ToDo: 06/07/2026 ==========
Falata criar os perfil
 - compras /suprimentos compras
  - Verificar os requisitos, cadastrar produtos, redirecinar a 'canteiro de obra'?
   - entrada no estoque

No móodulo do
segurança do trabalho falta controlar
 - EPI
 - EPC
 - Uniforme
 Verificar se só acompanha, ou dá a saída no estoque?


Perfil de almoxarife:
 Ficará interno nos canteiros existe espalhado pela região metropolitana da Grande Vitória.


Onde registraremos estoque entrada e saída, relatório de custo e etc...

Lembrando que serão várias equipes e temos 'canteiro de obra' espalhados pela cidade.



# ========== ToDo: 06/07/2026 ==========

# ========== ToDo: 02/07/2026 ==========

- O encarregado pode preencher somente o checklist da equipe dele OK



# ========== ToDo: 02/07/2026 ==========



# ========== ToDo: 20/06/2026 ========== 

  no perfil de frota após o veículos estiver cadastrado, não poder alterar o valor em "Custos e Gestão (Frota)" os campos "Origem" e "Valor mensal de aluguel (R$)" pois esse campo quem vai ter permissão para alterar é o medição

está precisando alterar as validação que zod mesmo, como
o ano no veículo tem que ter 4 digito numérico somente, devendo ser maior que 1970

e na verdade depois que o requerimento já está feito, o adm frota não pode editar os campos exeto "Template de checklist (override)" e "Motoristas titulares" assim como os anexo que ele pode adicionar a mais quando por exemplo a habilitação venceu e adiciona uma nova, mais não pode excluir a que já existe.



# ToDo
- No Wizard do requerimento
  - Juntar moto em véiculos leve
  - Onde tiver Muck virar Caminhão Muck
- Separar os tipos de equipamentos 
  - Pesados em:
    - Carreta
      -tipoCarreta(??)
    - Caminhão (Toco ou Truck)
      -tipoCaminhão
      - Pipa
      - Muck
      - Outros
    - Maquina
    - Retroescavadeira
    - Escavadeira
    - Rolo
      - Outros
  - Médios em:
    - Caminhonete
    - 3/4
  - Leves em:
    - Moto
    - Carro
    - Caminhonete

Uma vez que o requerimento de um veículo já estiver ativo para o motorista editar ele deve ter suas limitações de edições, por exemplo ele não pode alterar o valor do veículo, pois quem faz isso agora é outro perfil, ele terá apenas opção de visualização, no maximo que ele pode editar será TAG para registrar as tag, data de acsição e inicio de operação.

Reapare também que todas essas informações estão mudando e eu não tenho todas informações ainda, gostaria de deixando mais dinamico, mais tem que estar tudo entrelaçado para conseguir operar o sistema que me ajude a torna os processo mais claros e seguros, com as pessoas certas com as permissões certas, porém agora estamos juntando valores com medição e perfomace e estamos atribuindo a eles algumas responsábilidades, algumas coisas que for responsábilidade do TI vou deixar no perfil do TI adm ainda, porém futuramente teremos o aux ti também para tarefas e permissões diferente, sei que meu saldo é pouco por isso não gostaria que vc mexece no codigo agora e sim conversamos sobre etapas que começaremos



# ========== ToDo: 20/06/2026 ========== 





## Falta corrigir (ToDo)

# ========== 20/06/2026 ========== REUNIÃO COM ARTHUR
OK Nos requerimentos quando selecionado Retroescavadeira, Escavadeira serão somente Horimetro sem quilometragem, já para os demais serão inverso. e todos serão obrigatório.

Na opção do "Caminhao", vai virar "Caminhão Basculante" e na opção de trator vai virar "Caminhão Carroceria"
para ambos poderá escolher entre toco ou truc porém apenas no caminhão Carroceria poderá ter:

toco
  basculante ou carroceria
truk
  basculante ou carroceria
3/4
  carroceria

  verificar o conceito de requerimento e indicação

na opção dos carro leve deve haver motos também e caminhonete.

ano fabricação obrigatório idependente de proprio ou aluguel

tirar tipo de combustivel eletrico e hibrido.

tirar tipo potencia no requerimento do veicuclo em todos os tipos.


Adicionar Hora extra e dia extra na locação 

no responsável legal adicionar conta dados bancária
 - Banco
  - Pix
  - Agentecia
  - Conta

pode ser somente PIX ou Atencia e conta obrigatória e o pix opcional


anexar contrato obrigatório no DP e também poder gerar um contrato em world em primeiro mommento podendo evoluir para melhorias, neste contrato terá que vir todos os campos e campos de assinatura, com datas e tudo do requerimento.

o frota precisa informar a data de innicio do operador após finalizar o contrato.

performace cria as equipe e a parte organizacional

Criar dois módulos para o gestor de frota, sendo:
 - Verificar todos os checklist preenchidos, e não preenchidos, e também os não conformes,
 - Importar os dados do GETRAK Relatório do excel para o gestor de frota conferir suas operações
 

mudar o relacionamento do checklist do veículo para o tipo de veiculo

 
revisão de template de checklist em 6 meses onde o segurança irá revisar

o dp precisa revisar em 1 ano os contratos de veiculos e veículos/motorista

o perfil de medição precisa ser implementado com urgencia para extração de informações
medição cria os tipo de veículo, define valores mensal, dia extra, e valores de horas extra


# ========== 20/06/2026 ==========


# ========== 18/06/2026 ==========

VERIFICAR NOME PARA O SISTEMA, SUGESTÃO: 
- Yuri
  - ( MacroSys, MacroFlow, Macro Gestão, Macro Suite, Macro Core)
    - MACRO GESTÃO
    - MacroSys
- No requerimento de motorista/operador *Contato e Função* -> *Função / Cargo* está um campo aberto string, pegar de uma listagem criada pelo DP e no requerimento uma caixa de seleção com uma das opções selecionada obrigatóriamente.
A complexidade é que os perfil que podem conter dentro de cada requeridor é as funções que ele pode criar.
verificar a nível de (Encarregado)

Está faltando ajustar o fluxo *quando selecionar* no requerimento *motorista e veiculo*

- FLUXO DE REQUERIMENTO DO VEÍCULO TERMINA NO DP(OK) FALTA AJUSTAR O REQUERIMENTO DO FROTA QUANDO FOR CADASTRAR UM VEÚCLO DIRETO PARA O SEGURANÇA DO TRABALHO, E O SEGURANÇA RELACIONA O TEMPLATE AO CHECKLIST E O FROTA O SEG ENVIA O REQUERIMENTO PARA O DP.


- VERIFICAR SE TODA RASTREABILIDADE DA CRIAÇÃO E DESATIVAÇÃO DOS RECURSOS ESTÃO OK, SE PODE AUDITAR TRANQUILAMENTE EXEMPLO QUEM E QUANDO CRIOU USUÁRIO TAL, QUANDO FORAM QUE EDITARAM POR QUEM E TALS RECURSO (COISAS DE AUDITORIA).
17-06/2026 FOI CRIADO O TIMELINE PARA RESOLVER




- ZOD VALIDAÇÃO DE FORMULÁRIO (VALIDAR TODOS OS CAMPOS)

# ========== 18/06/2026 ==========
Verificando:
- NO FORMULÁRIO DE APROVAÇÃO DO DP, OS DADOS MOTORISTAS E VEICULOS ESTÃO VINDO TUDO JUNTO, SENDO QUE O MESMO DEVEM VIR INDIVIDUALMENTE, A REGRA É SE O REQUERIMENTO FOR OS DOIS DE UMA VEZ(MOTORISTA + VEÍCULO), VOU PRECISAR RELACIONAR UM FUNCIONÁRIO JÁ CADASTRADO E RELACIONAR ELE AO MOTORISTA TITULAR SE AMBOS FOREM APROVADOS PARA SEGUIR COM FLUXO OU SEJA, DENTRO DO WIZARD
E TAMBÉM O FUNCIONÁRIO VOU TER QUE LANÇAR E GERENCIAR SALARIO, BENEFICIOS, PLANO DE SAÚDE POR EXEMPLOS (CONFORME ESTAVA CAMINHANDO A V1)

- NA EDIÇÃO DE VEÍCULO PARA OS PERFIL DE TEC SEG OU ENCARREGADO ENTRE OUTROS NÃO PODE ALTERAR O VALOR DO ALUGUEL E DADOS DO VEÍCULO, ISSO SOMENTE O SETOR DE FROTA E O DP

- FUTURAMENTE MELHORAR O WIZARD NA HORIZONTAL
- FUTURAMENTE MELHORAR ALÉM DO KABAN E LISTA, MOSTRA EM FORMA DE FLUXO E EM QUAL MOMENTO ESTÁ IGUAL FOI DESENHADO

## Nescessário para produção
- Fazer o fluxo e cadastro com dados reais da aplicação testando a usabilidade.
- Corrigir os itens críticos acima.
- O ADM DE FROTA QUANDO SELECIONAR O MOTORISTA TITULAR E SE ESSE MOTORISTA ESTIVER EM OUTRO VEÍCULO, O MESMO DEVE SAIR PARA NÃO DAR PROBLEMA NA HORA DE PREENCHER O CHECKLIST
  - OU SEJA CONFLITO, OU VERIFICAR SE PODE TER UMA LISTA, DE VEÍCULOS PERMITIDOS DE MOTORISTA TITULAR NO EQUIPAMENTOS, OU VERIFICAR SE QUER INVERTER ADICIONANDO O EQUIPAMENTO NO MOTORISTA.
  - 
- INTEGRAR COM O PERFOMASE
...


## 16/06/2026
- Na *revisão* do *requerimento do veículo* não está aparecendo a observação no campo: "*Observações sobre o equipamento*".


## Falta analisar
- O adm frota também poderá dar acesso para os motoriste terem acesso no sistema? verificar

---

## 📦 Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload (porta 3000) |
| `npm run build` | Gera a build de produção em `build/` |
| `npm run preview` | Roda a build de produção localmente para teste |
| `npm run lint` | Executa o ESLint |

---

## 🔧 Troubleshooting (resolução de problemas comuns)

### ❌ `npm error ERESOLVE unable to resolve dependency tree`

**Causa:** conflito de peer dependencies (versões incompatíveis entre libs).

**Solução A (recomendada):**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

**Solução B:** Use `--force`:
```bash
npm install --force
```

### ❌ `Cannot find module '@/something'`

**Causa:** alias `@` não está sendo resolvido. Provavelmente o `vite.config.js` foi alterado ou está faltando.

**Solução:** Confirme que `vite.config.js` tem:
```js
resolve: {
  alias: { "@": path.resolve(__dirname, "./src") }
}
```

### ❌ Login retorna `auth/unauthorized-domain`

**Causa:** `localhost` não está autorizado no Firebase.

**Solução:** Siga o passo 6 acima.

### ❌ `Firebase: Error (auth/invalid-api-key)`

**Causa:** arquivo `.env` não foi carregado ou tem chave errada.

**Solução:**
1. Confirme que o `.env` está em `frontend/.env` (não em subpasta).
2. Confirme que cada linha começa com `VITE_FIREBASE_` (não `REACT_APP_`).
3. **Reinicie o servidor** (`Ctrl+C` e `npm run dev` de novo) — Vite só lê `.env` no startup.

### ❌ Porta 3000 já em uso

**Solução:** Vite mostra a porta disponível automaticamente (3001, 3002…). Ou mate o processo:

**Windows:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID_MOSTRADO> /F
```

**Mac/Linux:**
```bash
lsof -i :3000
kill -9 <PID>
```

### ❌ `Module not found: Can't resolve 'firebase/auth'`

**Causa:** `firebase` não foi instalado direito.

**Solução:**
```bash
npm install firebase
```

### ❌ Tela branca no navegador

**Solução:**
1. Abra o **Console** do navegador (F12)
2. Veja o erro real
3. Os mais comuns:
   - **`apiKey` undefined** → problema do `.env` (ver acima)
   - **`db` is undefined** → arquivo `lib/firebase.js` foi corrompido
4. Limpe cache do navegador: `Ctrl+Shift+R`

### ❌ Windows: erros de permissão / `EPERM`

**Solução:**
1. Feche o VS Code e qualquer outro programa usando a pasta
2. Rode o terminal **como Administrador**
3. Tente de novo

---


## 📁 Estrutura do projeto

```
frontend/
├── public/              # Assets estáticos
├── src/
│   ├── components/      # Componentes UI (shadcn + custom)
│   ├── contexts/        # AuthContext
│   ├── hooks/           # React hooks
│   ├── lib/             # Firebase init, helpers (whatsapp, pdf, roles)
│   ├── pages/           # Telas (rotas)
│   ├── App.js           # Roteamento
│   ├── main.jsx         # Entry point (Vite)
│   └── index.css        # Tailwind + global
├── index.html           # HTML root (Vite)
├── package.json
├── vite.config.js       # Config Vite (alias @, JSX em .js, porta 3000)
├── tailwind.config.js
├── postcss.config.js
└── .env                 # Credenciais Firebase
```

---

## 🛠 Stack

- **React 19** + **Vite 6**
- **Tailwind CSS 3** + **shadcn/ui** + **Phosphor Icons**
- **Firebase** Auth + Firestore + Storage
- **react-router-dom 7** · **sonner** (toasts) · **jspdf** (PDF) · **react-hook-form** + **zod**

---

## 📚 Fluxos principais

Veja o manual completo em [`MANUAL.md`](./MANUAL.md) (gere com o agente se não tiver).

Resumo:
1. **TI/Admin** cria usuários
2. **Encarregado / Admin Frota** cria Requerimento (Wizard 7 etapas dinâmicas)
3. **DP** aprova → encaminha para Segurança
4. **Segurança do Trabalho** prepara checklist (Template) + realiza Vistoria de Entrada
5. **Veículo fica ATIVO** → pode receber Checklist diário
6. **WhatsApp Click-to-Chat** abre conversa pronta a cada transição

---

## 🧱 Próximos passos sugeridos

- Migrar WhatsApp Click-to-Chat → API oficial Meta
- Cadastros próprios de Empresas, Funções, Centros de Custo
- Cursos/NRs com alertas de vencimento (CNH, ASO)
- Multi-empresa (Macro / Dinâmica / RC) com isolamento de dados
- Object Storage real (substituir base64)
- Relatórios exportáveis (CSV/Excel)
