# Manual do Departamento Pessoal (DP) — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco em aprovar pessoas e organizar equipes.

---

## O que você faz no sistema

- **Primeiro gargalo** do fluxo de Requerimento (aprova motoristas e veículos).
- Estrutura as **Equipes** (encarregado + motoristas + veículos).
- Cria/edita/desativa usuários (coadministrador do sistema).
- Configura os **Temas visuais** por perfil.

---

## Suas telas

### 📥 Requerimentos (`/requerimentos`)
Lista com status Pendente / Em Análise / Aprovado etc. Aberta a ficha:
- **Motorista**: confere ASO, CNH, contrato. **Aprova** → vira `NO_LOGIN_USER`; ou **Reprova**.
- **Veículo**: **Aprova** → vai para Segurança.
- **Veículo + Motorista**: aprova → segue para Segurança; motorista ativa quando a vistoria aprovar.

### 👥 Equipes (`/teams`)
Nova Equipe → define nome, encarregado responsável, motoristas membros (blocos "com login" e "aprovados sem login"). Ao salvar, o `teamId` propaga.

> A partir daqui, o Encarregado só vê a própria equipe.

### 👤 Usuários (`/users`)
Acesso total: criar do zero (qualquer perfil), editar dados, ativar/desativar, criar login para motoristas aprovados (E-mail ou Matrícula 7 dígitos).

### 🎨 Temas (`/temas`)
Configura cores da Sidebar e backgrounds **por perfil de acesso**. O que você definir para Motorista, por exemplo, será aplicado quando qualquer Motorista logar.

### 📄 Contrato (auto-gerado)
Ao aprovar Motorista com Contrato, o DP pode gerar um Word/PDF com todos os dados do Requerimento e assinaturas.

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| Sem **cadastro direto** de motorista/veículo — sempre via Requerimento. | Trilha auditável. |
| Anexo de contrato **obrigatório** ao aprovar motorista. | Formalização legal. |
| Contratos precisam de **revisão anual** (a definir alerta). | Compliance. |
| Só você (e Admin) pode editar dados críticos do usuário. | Sensibilidade dos dados pessoais. |

---

## FAQ rápido

**Motorista aprovado não aparece no checklist.**
Confirme se ele já foi vinculado a alguma **Equipe** (`/teams`) e se o Encarregado o vinculou a um veículo.

**Preciso ver histórico de aprovações.**
Peça ao TI para exportar a coleção `requerimentos` no BackupAdmin — filtro por status.

**Como redefino senha de motorista?**
Se for e-mail → link "Esqueci senha" no Firebase. Se for matrícula → o Encarregado/DP cria novo login com nova senha.
