# Manual Completo — Sistema MACRO AMBIENTAL

> **Plataforma web responsiva de gestão operacional de frota, motoristas, checklists, vistorias e requerimentos.**
> Documento único, detalhado, com telas + FAQ. Versão **Fev/2026**.
>
> Se você é usuário de um perfil específico, também temos manuais enxutos (1 página):
> `manual-motorista.md` · `manual-encarregado.md` · `manual-frota.md` · `manual-dp.md` · `manual-seguranca.md` · `manual-admin.md` · `manual-medicao.md` · `manual-performance.md`.

---

## Sumário

1. [O que é o sistema](#1-o-que-é-o-sistema)
2. [Perfis e responsabilidades](#2-perfis-e-responsabilidades)
3. [Como entrar (login)](#3-como-entrar-login)
4. [Regras inegociáveis](#4-regras-inegociáveis)
5. [Guia por perfil (detalhado)](#5-guia-por-perfil-detalhado)
   - [5.1 Motorista](#51-motorista)
   - [5.2 Encarregado](#52-encarregado)
   - [5.3 Administrador de Frota](#53-administrador-de-frota)
   - [5.4 Departamento Pessoal (DP)](#54-departamento-pessoal-dp)
   - [5.5 Segurança do Trabalho](#55-segurança-do-trabalho)
   - [5.6 Medição](#56-medição)
   - [5.7 Performance](#57-performance)
   - [5.8 Administrador TI](#58-administrador-ti)
6. [Módulos transversais](#6-módulos-transversais)
   - [6.1 Wizard de Requerimento (7 etapas)](#61-wizard-de-requerimento-7-etapas)
   - [6.2 Importação GETRAK](#62-importação-getrak)
   - [6.3 Painel de Checklists](#63-painel-de-checklists)
   - [6.4 Temas por perfil](#64-temas-por-perfil)
   - [6.5 Backup & Restauração](#65-backup--restauração)
7. [Cenário integrado ponta-a-ponta](#7-cenário-integrado-ponta-a-ponta)
8. [Glossário](#8-glossário)
9. [FAQ geral](#9-faq-geral)
10. [Hierarquia de aprovações](#10-hierarquia-de-aprovações)

---

## 1. O que é o sistema

**MACRO AMBIENTAL** é um sistema para gerir a entrada, autorização e operação diária de **veículos e motoristas** numa empresa de obras/saneamento. Toda inclusão passa por um fluxo controlado:

```
Indicação ? Requerimento ? DP ? Segurança ? Vistoria ? Veículo Ativo
```

### Princípio inviolável
**Não existe cadastro direto** de motorista/veículo — sempre via Requerimento.

Exceções administrativas (documentadas): TI/DP/Encarregado podem criar login para motorista **já aprovado** pelo DP; TI pode criar usuário do zero.

---

## 2. Perfis e responsabilidades

| Perfil | O que faz | Telas principais |
|---|---|---|
| **Motorista** | Preenche checklist digital diário. | `/checklist/digital`, `/checklists` |
| **Encarregado** | Abre **Indicações**, acompanha checklists da equipe, lança manual, cria login de motorista da equipe. | `/indicacoes`, `/checklists`, `/checklist/manual`, `/users` |
| **Admin Frota** | Converte Indicação em Requerimento, configura veículos, lança **Vistoria de Entrada**, importa GETRAK, consulta relatórios. | `/requerimentos/novo`, `/veiculos`, `/checklist/manual`, `/getrak`, `/frota/*` |
| **DP** | Primeiro gargalo — aprova/reprova Requerimentos, gerencia Equipes e Usuários, configura Temas. | `/requerimentos`, `/teams`, `/users`, `/temas` |
| **Segurança do Trabalho** | Cria templates de checklist, aprova vistoria do fluxo, revisa templates semestralmente. | `/templates`, `/vistorias`, `/templates/revisao` |
| **Medição** | Catálogo de **Tipos de Veículo** com valores mensais/extra + histórico de preços. | `/tipos-veiculo`, `/frota/custos` |
| **Performance** | Catálogo de **Funções/Cargos** + estrutura organizacional de Equipes. | `/funcoes`, `/teams` |
| **Admin TI** | Superusuário — cria/edita qualquer usuário, faz **Backup & Restauração**, resolve ambiente Firebase. | `/users`, `/backup`, `/temas`, tudo mais |

---

## 3. Como entrar (login)

A tela de login aceita **dois formatos no mesmo campo** — o sistema detecta automaticamente:

- **E-mail** (gestores, administrativos): `joao@macro.local`
- **Matrícula 7 dígitos** (motoristas internos): `1234567` — quando digitar 7 dígitos, aparece a legenda "? Detectado login por matrícula".

Recuperação:
- E-mail ? link "Esqueci senha" no Firebase.
- Matrícula ? Encarregado/DP/TI criam novo login.

Ao entrar, um **splash screen** navy aparece enquanto o Firebase inicializa (cold-start). Fade-out ao terminar.

Se o Admin/DP desativarem sua conta:
> "Acesso desativado. Procure o Departamento Pessoal."

Baixe este manual a qualquer momento na tela de login (botão **Baixar manual completo do sistema**).

---

## 4. Regras inegociáveis

Estas regras estão protegidas no código:

| Regra | Onde |
|---|---|
| ?? Não existe cadastro direto de motorista/veículo — sempre via Requerimento. | `/requerimentos/novo` |
| ? Exceção: Admin/DP/Encarregado criam login para motorista já aprovado. | `/users` |
| ?? Motorista só operacional após aprovação do DP (`approvedAt`). | Sistema inteiro |
| ?? **Placa** e/ou **TAG** obrigatórias no veículo. Placa é única. | Wizard Step 3 |
| ?? **Valor mensal** obrigatório em todo veículo (contabilidade gerencial). Para alugados vem do catálogo do Medição. | Wizard Step 5, VehicleDetail |
| ?? **1 template = 1 tipo de equipamento**. | `/templates` |
| ?? **1ª execução** de cada veículo é a **Vistoria de Entrada** — só Frota (ou Admin) lança. | `/checklist/manual`, `/checklist/digital` |
| ???????? Encarregado e Frota veem só **sua equipe**. | Sistema inteiro |
| ?? Dados bancários no Wizard: **PIX** OU **Banco+Ag+Conta**. | Wizard Step 3 |
| ?? Foto obrigatória no checklist bloqueia envio até o motorista anexar. | ChecklistFill |
| ? Toda operação de backup/import/reset registra em `audit_backups`. | BackupAdmin |

---

## 5. Guia por perfil (detalhado)

### 5.1 Motorista

**Objetivo:** preencher checklist diário em menos de 1 minuto pelo celular.

#### ?? `/checklist/digital` — Novo Checklist

**Fluxo típico da tela:**
- Cabeçalho: *"Bom dia, <nome>! Vamos ao checklist."*
- **Card do veículo titular** já selecionado (se você opera vários, aparece dropdown).
- **Banner azul** informativo do template: *"Template: Retroescavadeira · 21 itens"*.
- Itens com **defaultEnabled** já vêm como **Conforme (verde)**. Toque em **Não Conforme (vermelho)** apenas nos itens com problema.
- Campos condicionais (texto/número/foto) aparecem quando o item exige.
- Observações opcionais.
- Botão **Enviar checklist** ? grava + gera notificação WhatsApp para Encarregado e Frota.

**Bloqueios que você pode ver:**
- *"Este veículo ainda não tem Vistoria de Entrada."* ? só o Adm de Frota libera. Avise-o.
- *"Foto obrigatória no item X"* ? o botão de envio fica cinza até você anexar.
- *"Você não está vinculado a nenhum veículo — procure o Encarregado."*

#### ?? `/checklists` — Meus Checklists

Histórico só dos seus. Toque em qualquer para ver detalhes + **Imprimir/Salvar PDF** (botão azul).

---

### 5.2 Encarregado

**Objetivo:** gestão da equipe na ponta — indicar necessidades, acompanhar checklists, apoiar motoristas.

#### ?? `/indicacoes/nova` — Indicação de Necessidade
Não abre Requerimento — abre uma **Indicação** livre contando o que precisa. Status: `ABERTA`. O Frota converte no Wizard (`?fromIndicacao=<id>`).

#### ?? `/indicacoes` — Lista das Indicações
Vê as suas indicações e o status atual (Aberta, Convertida em Requerimento, Descartada).

#### ?? `/checklists` — Checklists da Equipe
Banner azul: *"Filtrando pela sua equipe: <nome> · N membros"*. Só os checklists da sua equipe aparecem.

#### ?? `/checklists/painel` — Painel de Checklists
Contadores em tempo real: Ativo · OK · Pendentes · Não-conformes — só da equipe.

#### ?? `/checklist/manual` — Lançar do Papel
Selecione motorista ? veículo padrão sugerido ? preencha item a item ? salvar.

#### ?? `/users` — Criar Login de Motorista
Só motoristas **da sua equipe** já aprovados pelo DP. Escolha E-mail ou Matrícula 7 dígitos + senha inicial e entregue ao motorista.

---

### 5.3 Administrador de Frota

**Objetivo:** dono operacional dos veículos — configurar, liberar, controlar custo.

#### ?? `/indicacoes` — Converter em Requerimento
Botão **"Converter em Requerimento"** abre o Wizard com o contexto preservado.

#### ?? `/requerimentos/novo` — Wizard 7 etapas
Consulte a seção [6.1 Wizard de Requerimento](#61-wizard-de-requerimento-7-etapas).

#### ?? `/veiculos` — Lista de Veículos
Cards com placa/TAG, modelo, status, badge de CRLV (verde/amarelo/vermelho). Toque para abrir o detalhe.

#### ?? `/veiculos/:id` — Detalhe do Veículo
Três blocos:
1. **Identificação**: TAG, placa, marca, modelo, ano.
2. **Custos e Gestão**: origem, valor mensal, patrimônio, aquisição, CRLV, equipe. *Após ativação, campos de origem/valor são somente-leitura para você (Medição altera).*
3. **Vínculos operacionais**: motorista titular + template de checklist.

#### ?? `/checklist/manual` — Vistoria de Entrada (1ª execução)
Banner azul: *"1ª execução deste veículo — Vistoria de Entrada."* Preencha os 21 itens. Botão vira **"Registrar Vistoria de Entrada"**.

Após isso, o veículo fica `ACTIVE` e o motorista opera normalmente.

#### ?? `/frota/relatorios` e `/frota/custos`
KPIs: total, patrimônio, custo mensal, idade média. Alertas CRLV. Alocação por equipe. Custos agregados por porte/tipo/equipe.

#### ?? `/getrak` — Importação GETRAK
Consulte [6.2 Importação GETRAK](#62-importação-getrak).

---

### 5.4 Departamento Pessoal (DP)

**Objetivo:** coadministrador — aprova pessoas, estrutura equipes, controla acessos e temas.

#### ?? `/requerimentos` — Fila de Análise
- **Motorista**: confere docs (ASO, CNH, contrato) ? **Aprova** ? vira `NO_LOGIN_USER` (aprovado sem login).
- **Veículo**: **Aprova** ? vai para Segurança.
- **Veículo + Motorista**: aprova ? segue para Segurança; motorista ativa quando vistoria aprovar.
- **Reprovar** marca como inativo.

#### ?? `/teams` — Equipes
Nova Equipe ? nome ? encarregado responsável ? motoristas membros (com login + sem login). `teamId` propaga automaticamente.

#### ?? `/users` — Usuários
Cria/edita/desativa qualquer usuário. Cria login para motoristas aprovados. Bloco **"Aprovados pelo DP · sem login"** facilita o processo.

#### ?? `/temas` — Temas por perfil
Configura Sidebar + backgrounds **por perfil de acesso**. Ex.: Motorista pode ver verde-escuro; DP azul-navy. Consulte [6.4 Temas](#64-temas-por-perfil).

---

### 5.5 Segurança do Trabalho

**Objetivo:** definir critérios técnicos de conferência dos equipamentos.

#### ?? `/templates` — Templates de Checklist
Novo template ? nome (= tipo do equipamento) ? itens com:
- **Texto** ("Verificar óleo")
- **Tipo**: Conforme/NC · Texto · Número · Foto
- **Obrigatório**, **Habilitado por padrão**, **Permitir foto**
- Opcional: **Legenda de criticidade** (VD/AZ/AM/VM) — VM bloqueia o veículo se marcado como NC.

Regra: **1 template por tipo** — o sistema bloqueia duplicatas.

#### ? `/vistorias` — Fila de Vistoria do Fluxo
Requerimentos aprovados pelo DP entram aqui. Você vincula template + preenche itens documentais/técnicos + **Aprova** (vai para Frota) ou **Reprova**.

> **Vistoria do fluxo** (você) ? **Vistoria de Entrada** (Frota). São momentos diferentes.

#### ?? `/templates/revisao` — Revisão semestral
A cada 6 meses o sistema alerta para você conferir o template. Alterações ficam registradas em `templateRevision`.

---

### 5.6 Medição

**Objetivo:** catálogo canônico de Tipos de Veículo com valores de aluguel.

#### ?? `/tipos-veiculo` — Catálogo
Cada tipo tem: nome, categoria/subtipo, porte, medição (KM/Horímetro), valor mensal, hora extra, dia extra, ativo/inativo, `historicoValores[]` (snapshot imutável de cada alteração de preço).

Quando o Frota abre Requerimento com origem "Alugado *", o input manual **some** e aparece um `<select>` puxando deste catálogo. O Wizard grava `tipoSnapshot` no documento do veículo — imutável.

#### ?? `/frota/custos` e `/frota/relatorios`
Agregados por Tipo/Equipe/Porte. Consulta comparativa.

---

### 5.7 Performance

**Objetivo:** catálogo de Funções/Cargos + estrutura de Equipes.

#### ?? `/funcoes` — Funções/Cargos
CRUD do catálogo. O Wizard puxa as **ativas** no combo de Função do Motorista.

#### ?? `/teams` — Equipes (compartilhado com DP)
Mesma tela do DP. Você foca na parte organizacional.

---

### 5.8 Administrador TI

**Objetivo:** superusuário — usuários, backup e ambiente.

#### ?? `/users` — Controle total
Cria qualquer perfil do zero. Ao criar Motorista, o sistema também cria o espelho em `drivers` (exceção documentada).

#### ?? `/backup` — Backup & Restauração
Consulte [6.5 Backup & Restauração](#65-backup--restauração). Um dos módulos mais poderosos:
- Filtro por Função na exportação XLSX de `users`.
- Empacotamento **XLSX + Mídias em ZIP** (default: ligado).
- Import JSON preservando IDs.
- Reset por coleção ou completo (com dupla confirmação + prompt "APAGAR TUDO").
- Auditoria em tempo real (`audit_backups`).

---

## 6. Módulos transversais

### 6.1 Wizard de Requerimento (7 etapas)

Acesso: Frota / DP / Admin (ou Frota convertendo Indicação do Encarregado).

Etapas:
1. **Tipo**: Veículo · Motorista · Veículo + Motorista
2. **Dados Iniciais**: proprietário, empresa (se aplicável)
3. **Informações Adicionais**:
   - Para Veículo: **cascata** Porte ? Categoria ? Subtipo ? Tipo. Ano fabricação sempre obrigatório. Ex.: Pesado ? Caminhões ? Toco ? Basculante.
   - Para Motorista: nome, CPF, CNH, categoria, ASO, dados bancários (**PIX OU Banco+Ag+Conta**), função (pool do Performance).
4. **Documentos**: upload de CRLV, CNH, ASO, contratos (Base64 por enquanto — migra para Storage no roadmap).
5. **Detalhes**:
   - Veículo: horímetro (Retro/Escav/Rolo) ou KM (demais). Origem: **Próprio** (input manual de valor) ou **Alugado *** (select do catálogo Medição ? grava `tipoSnapshot` imutável).
6. **Revisão**: cards com tudo consolidado.
7. **Conclusão**: ? verde + protocolo + botões (Ver requerimento / Criar outro / Painel).

Rascunho: pode ser salvo a qualquer momento.

### 6.2 Importação GETRAK

Acesso: Frota / Admin em `/getrak`.

1. Upload do Excel do sistema terceiro (deslocamentos + paradas por veículo).
2. O sistema relaciona automaticamente pela **placa**.
3. Tabela 100% largura com colunas: Placa, Motorista, **Horas totais** (grande, negrito), **Ocioso** (menor, sem negrito), KM, últimos locais.
4. Ao clicar num local, abre o Google Maps com lat/lng.
5. Sem duplicação de KM, sem "fantasma" de cabeçalho.

### 6.3 Painel de Checklists (`/checklists/painel`)

Acesso: Frota, Encarregado, Admin.

Contadores em tempo real: Ativo · OK · Pendentes · Não-conformes. Encarregado vê só a equipe; Frota/Admin veem tudo. Filtro clicável nos cards.

### 6.4 Temas por perfil (`/temas`)

Acesso: DP, Admin.

Configura CSS variables globais (`--sidebar-bg`, `--page-bg`, cores de acento, tipografia base) **por perfil**. Quando um Motorista loga, a Sidebar é a que o DP configurou para o role `motorista`. Contraste de leitura é obrigatório — o sistema alerta se o par (fundo × texto) ficar ilegível.

### 6.5 Backup & Restauração (`/backup`)

Acesso: só Admin TI.

Recursos:
- **Contagem em tempo real** das 11 coleções mapeadas.
- **Exportar por coleção**: JSON / CSV / XLSX. XLSX pode virar **XLSX+ZIP** com mídias (checkbox ligado por padrão): a planilha guarda **caminhos relativos** e o zip carrega os arquivos binários em `midias/<colecao>/<docId>/<campo>.<ext>`.
- **Filtro por Função (role)** no card `users` — dropdown padrão "Todos".
- **Backup completo**: JSON único ou XLSX multi-abas (+ opção ZIP).
- **Import JSON**: batches de 400 preservando o `id` original.
- **Reset por coleção**: dupla confirmação + prompt `RESETAR <COLECAO>`.
- **Reset banco completo**: prompt `APAGAR TUDO` — `audit_backups` é preservado.
- **Auditoria** em `audit_backups`: quem, quando, ação, formato, contagem, tamanho, filtro aplicado, nº de mídias empacotadas.

Recomendação de regras Firestore em produção:
```
match /audit_backups/{docId} {
  allow read, create: if isAdmin();
  allow update, delete: if false;   // imutável
}
```

---

## 7. Cenário integrado ponta-a-ponta

**Contexto:** empresa contratou o motorista João e adquiriu uma retroescavadeira alugada.

1. **Segurança** cria template "Retroescavadeira" (`/templates`).
2. **Medição** confirma o Tipo de Veículo "Retroescavadeira" no catálogo (`/tipos-veiculo`), valor R$ 15.000/mês.
3. **Encarregado** abre uma Indicação em `/indicacoes/nova` descrevendo a necessidade.
4. **Frota** converte a Indicação em Requerimento **Veículo + Motorista** (`/requerimentos/novo?fromIndicacao=<id>`) — Wizard 7 etapas.
5. **DP** analisa em `/requerimentos`, aprova ? motorista vira `NO_LOGIN_USER`, requerimento vai para Segurança.
6. **DP** monta a **Equipe Asfalto** em `/teams` com o encarregado Pedro e o motorista João.
7. **Encarregado** cria login para João em `/users` — matrícula `1234567` + senha inicial.
8. **Segurança** aprova a Vistoria do fluxo em `/vistorias` (vincula o template, confere docs).
9. **Frota** configura o veículo em `/veiculos/:id` (equipe, motorista titular, template) e lança a **Vistoria de Entrada** em `/checklist/manual`.
10. **Motorista João** loga com `1234567` + senha, veículo aparece pré-selecionado, preenche checklist em <1 min, envia.
11. **Encarregado** e **Frota** recebem notificação WhatsApp Click-to-Chat.
12. **Frota** consulta `/frota/relatorios` — novo veículo aparece nos KPIs; **Medição** vê `/frota/custos` atualizado.

? Operação ativa e rastreável ponta-a-ponta.

---

## 8. Glossário

| Termo | Significado |
|---|---|
| **Indicação** | Aviso do Encarregado dizendo o que precisa. Não é cadastro nem Requerimento — é o degrau anterior. |
| **Requerimento** | Solicitação formal de entrada de motorista/veículo. Único caminho para o cadastro chegar ao sistema. |
| **Aprovação do DP** | Marca formal (`approvedAt`) que autoriza motorista/veículo. |
| **Vistoria do fluxo** | Checagem documental feita pela Segurança dentro do fluxo do Requerimento. |
| **Vistoria de Entrada** | 1ª execução operacional do checklist do veículo, feita pela Frota. |
| **Checklist diário** | Demais execuções — motorista (app) ou encarregado (papel). |
| **Template** | Modelo de itens a conferir por tipo de equipamento. 1 por tipo. |
| **Legenda de criticidade** | Cores VD/AZ/AM/VM ligadas a itens do template. VM bloqueia o veículo automaticamente se NC. |
| **Equipe** | Encarregado + motoristas + (opcional) veículos. Estrutura montada por DP/Performance. |
| **TAG** | Identificador patrimonial (R-1, EQP-15). |
| **Placa** | Mercosul ou antiga. Única no sistema. |
| **Auto-aluguel interno** | Valor mensal atribuído a veículo próprio para contabilidade gerencial. |
| **`tipoSnapshot`** | Snapshot imutável do Tipo de Veículo gravado no doc do veículo — protege contrato de alterações retroativas. |
| **`audit_backups`** | Coleção de trilha imutável de operações do BackupAdmin. |
| **Matrícula** | Identificador interno 7 dígitos para login sem e-mail. |
| **Status motorista** | `PENDING_APPROVAL` ? `NO_LOGIN_USER` ? `ACTIVE` ? `INACTIVE`. |
| **Status veículo** | `PRE_REGISTERED` ? `PENDING_ACTIVATION` ? `ACTIVE` ? `INACTIVE`. |

---

## 9. FAQ geral

**Splash screen ficou preso.**
Aguarde até 6 segundos — há um fallback que remove o splash mesmo se o Firebase demorar. Se persistir, F5. Se ainda não abrir, avise o TI (provavelmente `.env` mal configurado ou domínio não autorizado no Firebase).

**Motorista aprovado não aparece no checklist.**
Confirma: (a) DP aprovou, (b) foi vinculado a uma Equipe (`/teams`), (c) tem veículo titular vinculado (feito pela Frota em `/veiculos/:id`).

**Excel de backup está gigante ou com colunas faltando.**
Marque o checkbox **"Empacotar mídias em .zip"** no BackupAdmin — o Base64 vira arquivo binário separado; a planilha guarda o caminho. Sem o ZIP, colunas com Base64 são omitidas para não estourar o limite de 32k caracteres do Excel.

**Perdi um usuário — como recupero?**
Se fez backup JSON antes, importe em `/backup` (ele preserva os IDs originais e faz merge). Sem backup, ligar para o TI checar o Firebase Console.

**Preciso trocar o motorista titular de um veículo ativo.**
`/veiculos/:id` ? bloco *Vínculos operacionais* ? alterar Motorista Titular ? salvar.

**Cadastro direto de motorista em `/users`?**
É exceção — documente por que fez. Preferível abrir Indicação ? Requerimento normal.

**Como sei que o WhatsApp foi enviado?**
Modal aparece com botão *Abrir conversa* — o clique abre `wa.me/{fone}?text=...`. É Click-to-Chat, não API oficial (integração Meta está no roadmap).

**Instalar o app no celular?**
Botão **Instalar App** na tela de login: Android/Chrome faz prompt nativo; iOS mostra instruções para "Adicionar à Tela de Início".

---

## 10. Hierarquia de aprovações

```
?????????????????
?  Encarregado  ?  abre Indicação
?????????????????
       ?
?????????????????
?  Adm de Frota ?  converte em Requerimento (Wizard)
?????????????????
       ?
?????????????????
?      DP       ?  aprova / reprova (docs, contratos)
?????????????????
       ?????? (Motorista somente) ? cria login em /users ? Operacional
       ?
       ?
?????????????????
?   Segurança   ?  vincula template + aprova vistoria do fluxo
?????????????????
       ?
?????????????????
?  Adm de Frota ?  configura veículo + Vistoria de Entrada (1ª exec.)
?????????????????
       ?
?????????????????
?   Motorista   ?  checklist diário pelo app
?????????????????
```

### Rotas rápidas (por perfil)

| Rota | Motor. | Enc. | Frota | DP | Seg. | Med. | Perf. | TI |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `/` (Dashboard) | ? | ? | ? | ? | ? | ? | ? | ? |
| `/checklist/digital` | ? | ? | | | | | | ? |
| `/checklist/manual` | | ? | ? | | | | | ? |
| `/checklists` | ? | ? | ? | ? | ? | ? | ? | ? |
| `/checklists/painel` | | ? | ? | | | | | ? |
| `/indicacoes` · `/indicacoes/nova` | | ? | ? | | | | | ? |
| `/requerimentos` · `/requerimentos/novo` | | | ? | ? | | | | ? |
| `/vistorias` | | | | | ? | | | ? |
| `/veiculos` · `/veiculos/:id` | | | ? | | ? | ? | ? | ? |
| `/motoristas` | | ? | ? | ? | ? | | | ? |
| `/frota/relatorios` · `/frota/custos` | | | ? | | | ? | ? | ? |
| `/getrak` | | | ? | | | | | ? |
| `/templates` · `/templates/revisao` | | | | | ? | | | ? |
| `/tipos-veiculo` | | | ? | ? | | ? | ? | ? |
| `/funcoes` | | | | | | | ? | ? |
| `/teams` | | | | ? | | | ? | ? |
| `/users` | | ? | ? | ? | | | | ? |
| `/temas` | | | | ? | | | | ? |
| `/backup` | | | | | | | | ? |

---

**Fim do manual.** Sugestões, correções ou pedidos de novos módulos: fale com o time de TI.
