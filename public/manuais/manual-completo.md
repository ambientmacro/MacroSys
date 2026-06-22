# Manual de Uso — Sistema MACRO AMBIENTAL

> **Plataforma de gestão de frota, motoristas, checklists e vistorias.**
> Documento de apresentação para usuários finais e equipe interna.
> Versão Jun/2026.

---

## Sumário

1. [O que é o sistema](#1-o-que-é-o-sistema)
2. [Perfis e responsabilidades](#2-perfis-e-responsabilidades)
3. [Como entrar no sistema (login)](#3-como-entrar-no-sistema-login)
4. [Regras de negócio inegociáveis](#4-regras-de-negócio-inegociáveis)
5. [Guia por perfil](#5-guia-por-perfil)
   - [5.1 Administrador TI](#51-administrador-ti)
   - [5.2 Departamento Pessoal (DP)](#52-departamento-pessoal-dp)
   - [5.3 Encarregado](#53-encarregado)
   - [5.4 Administrador de Frota](#54-administrador-de-frota)
   - [5.5 Segurança do Trabalho](#55-segurança-do-trabalho)
   - [5.6 Motorista](#56-motorista)
6. [Cenário integrado — operação completa de ponta a ponta](#6-cenário-integrado--operação-completa-de-ponta-a-ponta)
7. [Glossário](#7-glossário)
8. [FAQ — Perguntas frequentes](#8-faq--perguntas-frequentes)

---

## 1. O que é o sistema

**MACRO AMBIENTAL** é um sistema para gerir a entrada, autorização e operação diária de **veículos e motoristas** numa empresa de obras/saneamento.

Diferente de cadastros tradicionais "qualquer um inclui qualquer coisa", aqui **toda inclusão passa por um fluxo controlado**:

```
Requerimento ? DP analisa ? Segurança define checklist ? Frota recebe e opera
```

O sistema garante que:

- Motoristas só operam após autorização formal do DP.
- Veículos só ficam ativos após Vistoria de Entrada feita pela Frota.
- Cada equipamento tem um template de checklist único (Retroescavadeira, Caminhão, Carro Leve, etc.).
- O Encarregado vê apenas a sua equipe.
- O Administrador de Frota acompanha custos, idade da frota, vencimentos de CRLV e patrimônio.
- O Motorista preenche checklist diário pelo celular, simples e direto.

---

## 2. Perfis e responsabilidades

| Perfil | O que ele faz no sistema | Telas principais |
|---|---|---|
| **Administrador TI** | Cria/edita/desativa qualquer usuário; configura ambientes; resolve casos especiais. | `/users` (acesso completo), `/templates`, `/teams` |
| **Departamento Pessoal (DP)** | Autoriza motoristas e veículos no fluxo de Requerimento; gerencia equipes (encarregado + motoristas); cria login para motoristas aprovados; desativa acessos. | `/requerimentos`, `/teams`, `/users` |
| **Encarregado** | Abre Requerimentos; acompanha checklists da sua equipe; cria login para motoristas da sua equipe; lança checklist quando o motorista responde no papel. | `/requerimentos/novo`, `/checklists` (filtrado pela equipe), `/checklist/manual`, `/users` |
| **Administrador de Frota** | Aprova requerimentos de veículos; define o template padrão do equipamento; vincula motorista titular; lança a Vistoria de Entrada do veículo; consulta os relatórios de patrimônio e custo. | `/veiculos`, `/frota/relatorios`, `/checklist/manual` (1ª execução) |
| **Segurança do Trabalho** | Cria/edita os templates de checklist (1 por tipo de equipamento); aprova/reprova vistorias do fluxo de requerimento. | `/templates`, `/vistorias` |
| **Motorista** | Faz o checklist diário pelo celular antes de iniciar a operação; consulta seu histórico; imprime/salva PDF. | `/checklist/digital`, `/checklists` (somente os seus) |

---

## 3. Como entrar no sistema (login)

A tela de login aceita **dois formatos no mesmo campo**:

### Opção A — E-mail
- Quem usa: gestores, administrativos, motoristas que têm e-mail.
- Recuperação de senha: pelo próprio Firebase (link "Esqueci a senha").
- Exemplo: `joao@macro.local`

### Opção B — Matrícula de 7 dígitos
- Quem usa: motoristas internos que já têm matrícula da empresa.
- Como funciona: ao digitar 7 dígitos numéricos, o sistema mostra `? Detectado login por matrícula (7 dígitos)`. A conversão para o Firebase é transparente.
- Recuperação de senha: feita pelo Encarregado/DP/Admin (criar novo login).
- Exemplo: `1234567`

> **Dica:** o sistema mostra automaticamente quando detecta matrícula. Não precisa escolher entre uma aba e outra — basta digitar.

### Quando o acesso é bloqueado
Se o Admin TI ou o DP desativarem o usuário, a tentativa de login devolve:
> *"Acesso desativado. Procure o Departamento Pessoal."*

---

## 4. Regras de negócio inegociáveis

Estas regras estão protegidas no código e **não podem ser violadas**:

| Regra | Onde se aplica |
|---|---|
| ?? **Não existe cadastro direto** de motorista ou veículo — sempre via Requerimento. | `/requerimentos/novo` |
| ? Exceção administrativa: Admin TI, DP e Encarregado podem **criar login diretamente** para motorista (entrega rápida de acesso, mas sem pular o DP — o motorista precisa estar aprovado antes). | `/users` |
| ?? **Motorista só fica operacional após aprovação do DP** (`approvedAt` gravado). Antes disso, NÃO aparece em listas de checklist nem como titular de veículo. | Sistema inteiro |
| ?? **Placa do veículo e TAG** é obrigatória. Quando preenchida, a placa é única no sistema. | Wizard Step 3 |
| ?? **Valor mensal de aluguel é obrigatório para TODO veículo**, mesmo os próprios (auto-aluguel interno) — necessário para relatórios de custo. | Wizard Step 5, VehicleDetail |
| ?? **1 template = 1 tipo de equipamento.** Ex.: "Retroescavadeira" tem 1 template usado tanto na Vistoria de Entrada quanto no Diário. Não cria 2 templates para o mesmo tipo. | `/templates` |
| ?? **A 1ª execução de cada veículo é a Vistoria de Entrada** — só o Adm de Frota (ou Admin) pode lançá-la. Os outros perfis ficam bloqueados com mensagem clara até a Vistoria ser registrada. | `/checklist/manual`, `/checklist/digital` |
| ???????? **Encarregado e Frota só veem motoristas/veículos da sua equipe.** A equipe é definida pelo DP. | `/checklists`, `/veiculos`, `/users` |

---

## 5. Guia por perfil

### 5.1 Administrador TI

**Quando usar este perfil:** raramente, apenas para tarefas administrativas (criar primeiros usuários gestores, ajustar perfis, casos especiais).

#### Telas e ações

**`/users` — Usuários do Sistema**
1. **"Novo usuário" (botão azul superior):** cria um usuário do zero (qualquer perfil).
   - Quando o perfil escolhido for *Motorista*, o sistema cria automaticamente o espelho na coleção operacional `drivers` — esse motorista já fica habilitado para checklist (exceção administrativa).
2. **Editar usuário (botão lápis):** altera nome, telefone, função. O e-mail/login do Firebase não muda por aqui.
3. **Desativar / Reativar:** alterna o acesso. Usuário desativado não consegue logar (mensagem clara é exibida).
4. **Excluir (lixeira vermelha):** remove o registro do usuário do banco. Use com cuidado.

**`/templates` — Templates de Checklist**
Embora seja função da Segurança do Trabalho, o Admin TI também acessa.

**`/teams` — Equipes**
Embora seja função do DP, o Admin TI também acessa.

---

### 5.2 Departamento Pessoal (DP)

**O DP é coadministrador do sistema.** Ele controla quem entra, quem é aprovado e quem opera.

#### Tela 1 — `/requerimentos`

Lista todos os Requerimentos em andamento. O DP é o **primeiro gargalo** do fluxo.

- **Status "Pendente Análise":** abre o detalhe, confere documentos, vê dados pessoais, contratos, assinaturas, ASO, validade de CNH etc.
- **Para Motorista:** clica em **"Aprovar"** ? o motorista vira `Aprovado · sem login` e já pode receber login pelo `/users`.
- **Para Veículo:** clica em **"Aprovar"** ? o requerimento vai para a fila da Segurança do Trabalho (que define o template).
- **Para Veículo + Motorista (combinado):** aprova ? vai para Segurança; quando a vistoria for aprovada, o motorista também é ativado automaticamente.
- **Reprovar:** o sistema marca o motorista/veículo como inativo. Use quando faltam documentos críticos.

#### Tela 2 — `/teams` — Equipes

Aqui o DP estrutura as equipes operacionais (ex.: *Equipe Asfalto*, *Equipe Drenagem*).

1. **"Nova Equipe":** define o nome.
2. **Seleciona o encarregado responsável** (o líder que vai gerenciar a equipe no dia a dia).
3. **Marca os motoristas que pertencem à equipe** — dois blocos:
   - **Motoristas com login no sistema** (usuários que já entraram pelo `/users` ou que receberam login via "Criar login").
   - **Motoristas pré-cadastrados sem login** (vindos do fluxo do Requerimento, antes da entrega do acesso).
4. **Salvar** — o sistema propaga o `teamId` para todos os membros e para o líder, automaticamente.

> A partir desse momento, o Encarregado escolhido só enxerga os motoristas, veículos e checklists dessa equipe.

#### Tela 3 — `/users` — Usuários do Sistema

O DP tem **acesso total** igual ao Admin TI:
- Cria login para motoristas aprovados (modal com 2 opções: E-mail ou Matrícula 7 dígitos).
- Edita dados de qualquer usuário.
- Ativa/desativa acesso ao sistema.
- Cria usuários do zero (exceção administrativa).

---

### 5.3 Encarregado

**O Encarregado é o gestor da equipe na ponta.** Ele abre requerimentos, acompanha checklists e dá apoio.

#### Tela 1 — `/requerimentos/novo`

Wizard guiado em 6 passos. Pode requerer:
- **Apenas motorista** (contratação nova).
- **Apenas veículo** (compra ou aluguel novo).
- **Veículo + motorista** (entrada combinada).

> **Atenção:** observações do motorista escritas no Wizard aparecem inteiras (texto multilinha) na revisão antes de enviar. Confira antes de submeter.

Após enviar, o requerimento vai para a fila do DP.

#### Tela 2 — `/checklists`

Mostra automaticamente os checklists da **sua equipe** (filtrado pelo `teamId`). Banner azul aparece confirmando: *"Filtrando pela sua equipe: Equipe Asfalto · 6 membros"*.

Toque em qualquer checklist para ver detalhes + imprimir/salvar PDF.

#### Tela 3 — `/checklist/manual` (Lançar checklist do papel)

Quando o motorista preenche o checklist em papel (sem celular):
1. Seleciona o motorista da equipe.
2. O veículo padrão é sugerido automaticamente.
3. Lança item a item.
4. Salva.

#### Tela 4 — `/users` — Criar Login Motorista

O Encarregado pode entregar login a motoristas **da sua equipe** já aprovados pelo DP:
1. No bloco *"Aprovados pelo DP · sem login"*, encontra o motorista.
2. Clica em **"Criar login"**.
3. Escolhe **E-mail** ou **Matrícula 7 dígitos**.
4. Define uma senha inicial (mínimo 6 caracteres).
5. **Anota e entrega ao motorista.**

> **Importante:** o Encarregado não vê motoristas de outras equipes — só os que o DP relacionou à sua.

---

### 5.4 Administrador de Frota

**O Administrador de Frota é o dono operacional dos veículos.** Recebe o equipamento, libera para uso e acompanha custos.

#### Tela 1 — `/veiculos` — Lista de Veículos

- Lista todos os veículos cadastrados, com **TAG**, **Placa** (placa azul-marinho), modelo, valor mensal, origem (próprio/alugado/prestação) e alerta visual de CRLV vencido/a vencer (badge/vermelho).
- Toque em qualquer card para abrir o detalhe.

#### Tela 2 — `/veiculos/:id` — Detalhe do Veículo

Edição completa. Tem 3 blocos:

**1. Identificação**
- TAG (patrimonial)
- Placa (Mercosul ou antigo) para o uso do partner zod regex
- Marca / Modelo / Ano

**2. Custos e Gestão (Frota)** — esta é a área mais importante
- **Origem:** próprio / alugado / prestação de serviço (ocultar essa parte por enquanto e ajustar para relacionar o motorista ao checkilist)
- **Valor mensal de aluguel (R$)** — *obrigatório, mesmo para próprios*. Vai para os relatórios de custo.
- **Valor de patrimônio (R$)** — usado em depreciação dos próprios.
- **Data de aquisição** — usado para idade da frota.
- **Vencimento do CRLV** — usado nos alertas do Dashboard e Relatórios.
- **Equipe responsável** — define qual equipe opera o veículo (combina com a estrutura criada pelo DP).

**3. Vínculos operacionais**
- **Motorista titular** — o motorista padrão deste veículo. Quando ele logar, o veículo já vem auto-selecionado no checklist.
- **Template de checklist** — escolhe qual template (criado pela Segurança) será usado nas vistorias e diários deste veículo.

#### Tela 3 — `/frota/relatorios` — Relatórios da Frota

Quatro KPIs no topo, em cards coloridos:
- **Total de veículos** (próprios + alugados + prestação)
- **Patrimônio total dos próprios** (soma `valorPatrimonio`)
- **Custo mensal de aluguel** (terceiros + auto-aluguel interno)
- **Idade média da frota** (baseada em ano de fabricação ou data de aquisição)

Abaixo dos KPIs:
- **CRLV — vencimentos críticos:** lista de veículos vencidos ou a vencer em até 30 dias, cada um linkando para o detalhe.
- **Alocação por equipe:** quantos veículos cada equipe tem + custo agregado por equipe + placas com as TAGs.

#### Tela 4 — `/checklist/manual` (Vistoria de Entrada)

Quando um veículo recém-ativado é apresentado ao Adm de Frota, **ele faz a Vistoria de Entrada** (que é o primeiro checklist do veículo). O sistema detecta automaticamente que é a 1ª execução e:
- Mostra um banner azul: *"1ª execução deste veículo — Vistoria de Entrada."*
- O botão muda de "Salvar checklist" para "**Registrar Vistoria de Entrada**".
- Outros perfis (motorista, encarregado) que tentarem lançar antes do Adm de Frota são bloqueados com mensagem clara.

A partir dessa 1ª execução, o veículo está liberado e o motorista/encarregado podem lançar o checklist diário normalmente.

---

### 5.5 Segurança do Trabalho

**A Segurança define os critérios técnicos do que será conferido em cada equipamento.**

#### Tela 1 — `/templates` — Templates de Checklist

1. **"Novo template":** define o nome (= tipo do equipamento — ex.: "Retroescavadeira", "Caminhão Toco", "Carro Pequeno").
   - **Atenção:** só 1 template por tipo. O sistema bloqueia duplicatas com mensagem clara.
2. **Adiciona os itens** que serão checados. Cada item tem:
   - **Texto** (ex.: "Verificar nível de óleo do motor")
   - **Tipo:**
     - *Conforme/Não Conforme* (botão verde/vermelho)
     - *Texto* (campo aberto)
     - *Número*
     - *Foto*
   - **Obrigatório** (sim/não)
   - **Habilitado por padrão** (já vem marcado como "Conforme" para o motorista — agiliza)
   - **Permitir foto** (motorista pode anexar foto do item)
3. **Salva** — o template fica disponível para a Frota vincular aos veículos.

#### Tela 2 — `/vistorias` — Vistorias do fluxo de Requerimento

Quando o DP aprova um Requerimento de veículo, este aparece na fila da Segurança. A Segurança então:
1. Abre o requerimento.
2. **Vincula um template** (caso o veículo precise de um específico).
3. **Preenche os itens** da vistoria do fluxo (uma checagem inicial documental/técnica).
4. **Aprova** ? o veículo vai para a fila da Frota (que vai ativar e fazer a Vistoria de Entrada propriamente dita).
5. **Reprova** ? o veículo não entra no sistema.

> Esta "vistoria do fluxo" é diferente da "Vistoria de Entrada" (que é a 1ª execução de checklist do veículo, feita pelo Adm de Frota). Ambas existem porque servem a momentos diferentes.

---

### 5.6 Motorista

**O motorista é o usuário final no campo.** O sistema foi desenhado para ele preencher o checklist em **menos de 1 minuto pelo celular**.

#### Tela 1 — `/checklist/digital` — Novo Checklist Diário

Quando ele logar, vai ver:
- Cabeçalho: *"Bom dia! Vamos ao checklist."*
- **Card azul-marinho com o seu veículo** já selecionado (se ele é titular de um único veículo): TAG, placa, modelo. Se ele tem múltiplos veículos, aparece um seletor.
- **Template auto-selecionado** (definido pela Frota): aparece como badge informativa *"Template: Retroescavadeira · 21 itens"*.
- **Lista de itens prontos para responder:**
  - Itens "Habilitados por padrão" já vêm como **Conforme** (botão verde).
  - O motorista só toca em **Não Conforme** nos itens com problema.
  - Campo de texto/número/foto se o item exigir.
- **Observações** (campo opcional)
- Botão **"Enviar checklist"** ? grava e gera notificação WhatsApp para Encarregado e Frota.

Após enviar:
- Mensagem de sucesso *"Checklist registrado"*.
- Dois botões: **"Ver detalhe / Imprimir"** e **"Meus checklists"**.

#### Tela 2 — `/checklists` — Meus Checklists

Histórico dos checklists que o motorista preencheu. Toque em qualquer registro para ver detalhes e **imprimir/salvar PDF** (botão azul "Imprimir / Salvar PDF").

#### Quando o sistema bloqueia o motorista

Se o veículo ainda não teve a Vistoria de Entrada feita pelo Adm de Frota, o motorista vê:
> ?? *"Este veículo ainda não tem Vistoria de Entrada. Apenas o Adm de Frota pode lançar a 1ª execução. Avise o gestor para liberar o equipamento."*

E o botão fica "Aguardando Adm de Frota" — desabilitado.

---

## 6. Cenário integrado — operação completa de ponta a ponta

Para ilustrar a integração entre os perfis, segue um caso real:

### Cenário: A empresa contratou um novo motorista (João) e adquiriu uma retroescavadeira.

#### Passo 1 — Segurança do Trabalho prepara o template
- Acessa `/templates`.
- Cria template **"Retroescavadeira"** com os 21 itens da vistoria/diário (verificar óleo, freios, vazamentos, EPIs disponíveis no equipamento, etc.).

#### Passo 2 — Encarregado abre os Requerimentos
- Acessa `/requerimentos/novo`.
- Cria um Requerimento **Veículo + Motorista**:
  - Motorista: João, telefone, função "Operador de Máquinas", CNH categoria E, ASO em dia.
  - Veículo: Retroescavadeira, marca/modelo, ano, placa (se houver), valor mensal de aluguel R$ 15.000,00, origem "alugado".
- Submete. Notificação vai para o DP.

#### Passo 3 — DP analisa
- Acessa `/requerimentos`.
- Abre o requerimento, confere contratos, ASO, CNH.
- Clica em **"Aprovar"**.
- O sistema marca o motorista João como `Aprovado · sem login` e o requerimento vai para a fila da Segurança.

#### Passo 4 — DP cria a equipe (se ainda não existir)
- Acessa `/teams`.
- Cria **"Equipe Asfalto"** com:
  - Encarregado responsável: Pedro
  - Motoristas membros: João (recém-aprovado), entre outros.
- Salva.

#### Passo 5 — Encarregado cria o login do motorista
- Acessa `/users` ? bloco **"Aprovados pelo DP · sem login"**.
- Vê o João. Clica em **"Criar login"**.
- Escolhe **Matrícula 7 dígitos** (porque João já tem matrícula `1234567` na empresa).
- Define senha inicial: `senha123`.
- Entrega para o João: *"Sua matrícula é 1234567 e a senha inicial é senha123. Acesse pelo celular."*

#### Passo 6 — Segurança aprova a vistoria do requerimento
- Acessa `/vistorias`.
- Abre o requerimento da retroescavadeira.
- Vincula o template "Retroescavadeira" criado no Passo 1.
- Confere os itens documentais e técnicos.
- **Aprova**. O veículo vai para a fila da Frota.

#### Passo 7 — Adm de Frota recebe o veículo e configura
- Acessa `/veiculos`.
- Vê a retroescavadeira recém-ativada.
- Abre o detalhe `/veiculos/<id>`:
  - Confere a placa, TAG.
  - **Custos e Gestão:** confirma valor aluguel R$ 15.000, define data de aquisição, vencimento do CRLV.
  - **Equipe responsável:** Equipe Asfalto.
  - **Vínculos operacionais:** define o **motorista titular** (João) e o **template de checklist** (Retroescavadeira).
- Salva.

#### Passo 8 — Adm de Frota faz a Vistoria de Entrada
- Acessa `/checklist/manual`.
- Seleciona o veículo. O sistema mostra o banner azul: *"1ª execução deste veículo — Vistoria de Entrada."*
- Preenche os 21 itens.
- Clica em **"Registrar Vistoria de Entrada"**.

#### Passo 9 — Motorista João começa a usar o sistema
- Abre o navegador do celular no link da empresa.
- Faz login com matrícula `1234567` e senha `senha123`.
- O sistema detecta automaticamente: *"? Detectado login por matrícula (7 dígitos)"*.
- É redirecionado para o Dashboard, com menu reduzido (Novo Checklist Diário, Meus Checklists).
- Vai em **"Novo Checklist Diário"**:
  - O card azul aparece com a retroescavadeira (já é o veículo titular).
  - O template "Retroescavadeira" já vem selecionado.
  - Os itens "Habilitados por padrão" já estão marcados como Conforme.
  - Ele só toca em **"Não Conforme"** num item específico, anexa foto.
  - Adiciona uma observação curta.
  - Clica em **"Enviar checklist"**.

#### Passo 10 — Encarregado e Frota são notificados
- Notificação WhatsApp é gerada com link para o detalhe.
- O Encarregado Pedro abre `/checklists` e vê o registro do João (banner *"Filtrando pela sua equipe: Equipe Asfalto"*).
- Pode imprimir/salvar PDF do checklist.

#### Passo 11 — Adm de Frota consulta os relatórios
- Acessa `/frota/relatorios`.
- Vê os KPIs atualizados: novo veículo no custo mensal R$ 15.000 (terceiros), idade média recalculada.
- Vê a Retroescavadeira no bloco *"Alocação por equipe: Equipe Asfalto · custo mensal R$ 15.000"*.

? **Operação ativa e rastreável de ponta a ponta.**

---

## 7. Glossário

| Termo | O que significa |
|---|---|
| **Requerimento** | Solicitação formal de entrada de motorista, veículo ou ambos. Único caminho para o cadastro chegar ao sistema. |
| **Aprovação do DP** | Marca o motorista/veículo como autorizado. Gera o campo `approvedAt`, que é a "prova" de aprovação. Sem isso, o sistema trata como pendente. |
| **Vistoria de Entrada** | 1ª execução de checklist do veículo após ele entrar na operação. Exclusiva do Adm de Frota. |
| **Diário** | Demais execuções de checklist (do dia a dia). Feita pelo motorista (app) ou encarregado (papel). |
| **Template** | Conjunto de itens a serem checados para um tipo de equipamento. 1 template por tipo. |
| **Equipe** | Agrupamento operacional (encarregado + motoristas + opcionalmente veículos). Estrutura criada pelo DP. |
| **TAG** | Identificador patrimonial do equipamento (ex.: R-1, EQP-15). Pode ser "sem TAG" para terceirizados. |
| **Placa** | Placa Mercosul ou antiga. Opcional para equipamentos sem emplacamento. Quando preenchida, é única. |
| **Auto-aluguel interno** | Valor mensal atribuído a um veículo próprio para fins de relatório de custo (não é cobrança real, é contabilidade gerencial). |
| **Status do motorista** | `PENDING_APPROVAL` (aguardando DP) ? `NO_LOGIN_USER` (aprovado, sem login) ? `ACTIVE` (aprovado, com login). |
| **Status do veículo** | `PRE_REGISTERED` (criado, aguardando vistoria do fluxo) ? `PENDING_ACTIVATION` (aguardando Frota) ? `ACTIVE` (operando) ? `INACTIVE` (desativado). |
| **Matrícula** | Identificador interno de 7 dígitos numéricos usado por motoristas para login. Equivalente a um e-mail no Firebase. |

---

## 8. FAQ — Perguntas frequentes

**Por que o motorista que cadastrei não aparece no checklist?**
Provavelmente o DP ainda não aprovou o requerimento dele. Vá em `/motoristas` — ele estará no bloco amarelo *"Aguardando aprovação do DP"*.

**Criei um template e ele não aparece para o motorista. Por quê?**
Pode ser que o veículo do motorista não tenha esse template vinculado. Vá em `/veiculos/<id>` e configure o campo *"Template de checklist"* na seção *"Vínculos operacionais"*.

**Motorista esqueceu a senha. Como redefino?**
- Se o login dele foi por **e-mail**: ele clica em "Esqueci a senha" na tela de login (Firebase envia link de reset).
- Se foi por **matrícula**: o Encarregado/DP/Admin precisa criar um novo login para ele (futura versão terá tela de redefinição interna).

**Veículo aparece bloqueado com mensagem "Aguardando Adm de Frota". O que faço?**
O veículo ainda não teve a 1ª execução (Vistoria de Entrada). Acione o Adm de Frota — só ele pode liberar o equipamento na 1ª vez.

**Preciso reaproveitar um motorista de outra equipe. Como faço?**
O DP edita a equipe em `/teams` e move o motorista. O `teamId` é atualizado automaticamente.

**Desativei um usuário por engano. Posso reativar?**
Sim. Em `/users`, encontre o usuário (o card vai estar com opacidade reduzida e badge "Inativo"). Clique em **"Reativar"**.

**O sistema oferece exportação para Excel?**
Não nesta versão. Os relatórios da Frota podem ser impressos via PDF do navegador (Ctrl+P). Exportação CSV/Excel está no roadmap.

**Por que existe Vistoria do fluxo (Segurança) e Vistoria de Entrada (Frota)?**
São momentos diferentes:
- A **Vistoria do fluxo (Segurança)** é uma checagem inicial documental/técnica feita logo após a aprovação do DP, ainda no fluxo do Requerimento — autoriza ou não a continuação.
- A **Vistoria de Entrada (Frota)** é o 1º checklist operacional do veículo já recebido — confere o estado físico no momento da entrega para uso. Usa o mesmo template do checklist diário.

**Como o Encarregado garante que vê só a sua equipe?**
O sistema usa o `teamId` em cada motorista/usuário. Quando o Encarregado loga, ele só carrega registros das equipes onde ele é líder ou membro. Banner azul aparece confirmando o filtro.

---

## Anexos rápidos

### Hierarquia de aprovações (resumo)

```
????????????????
?  Encarregado ?  abre Requerimento
????????????????
       ?
       ?
????????????????
?      DP      ?  aprova (contratos, documentos)
????????????????
       ?
       ?????? (Motorista)  ? DP cria login ? Operacional
       ?
       ?
????????????????
?   Segurança  ?  vincula template + aprova vistoria do fluxo
????????????????
       ?
       ?
????????????????
?  Adm Frota   ?  configura veículo + faz Vistoria de Entrada
????????????????
       ?
       ?
????????????????
?   Motorista  ?  preenche checklist diário pelo app
????????????????
```

### Identificadores rápidos das rotas

| Rota | Quem acessa | Para que serve |
|---|---|---|
| `/` | Todos | Dashboard inicial |
| `/login` | Anônimo | Login dual (e-mail / matrícula) |
| `/requerimentos` | Encarregado, Frota, DP, Admin | Lista de requerimentos |
| `/requerimentos/novo` | Encarregado, Frota, Admin | Wizard de novo requerimento |
| `/requerimentos/:id` | Encarregado, Frota, DP, Admin | Detalhe + aprovação |
| `/veiculos` | Todos os gestores | Lista de veículos |
| `/veiculos/:id` | Frota, Admin | Detalhe e edição do veículo |
| `/frota/relatorios` | Frota, Admin | KPIs e relatórios |
| `/motoristas` | Todos os gestores | Lista de motoristas |
| `/teams` | DP, Admin | Gestão de equipes |
| `/templates` | Segurança, Admin | Templates de checklist |
| `/vistorias` | Segurança, Admin | Fila de vistorias do fluxo |
| `/checklist/digital` | Motorista, Encarregado | Lançar checklist (app) |
| `/checklist/manual` | Encarregado, Frota, Admin | Lançar checklist (papel) |
| `/checklists` | Todos | Histórico (filtrado por perfil) |
| `/checklists/:id` | Todos | Detalhe + imprimir/PDF |
| `/users` | Admin, DP, Encarregado, Frota | Usuários e logins de motorista |

---

**Fim do manual.** Para ajustes ou novas funcionalidades, consulte o time de desenvolvimento.
