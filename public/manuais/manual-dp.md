# Manual do Departamento Pessoal (DP) — MACRO AMBIENTAL

> Guia rápido para o DP, que é **coadministrador** do sistema.

---

## Visão geral do seu papel

O DP é o **primeiro gargalo** do fluxo de entrada. Sem você, ninguém entra no sistema.

Suas responsabilidades:

1. **Aprovar/reprovar Requerimentos** de motoristas e veículos.
2. **Gerenciar Equipes** (encarregado + motoristas).
3. **Criar login** para motoristas aprovados (entregar o acesso ao sistema).
4. **Editar dados** de qualquer usuário (nome, telefone, função).
5. **Ativar/desativar** o acesso de qualquer usuário ao sistema.

Você tem acesso completo a `/users`, igual ao Administrador TI.

---

## 1. Analisar Requerimentos

Menu **"Requerimentos"**.

Para cada requerimento pendente:

1. Toque para abrir o detalhe.
2. Confira documentos, contratos, ASO, CNH, dados pessoais, observações.
3. Para **motorista**:
   - **Aprovar** ? marca o motorista como `Aprovado · sem login` e gera o campo `approvedAt` (prova de aprovação).
   - **Reprovar** ? motorista entra como inativo.
4. Para **veículo**:
   - **Aprovar** ? vai para a fila da Segurança do Trabalho (que vincula template e faz a vistoria do fluxo).
   - **Reprovar** ? veículo descartado.
5. Para **veículo + motorista** (combinado):
   - Mesmo fluxo do veículo. Quando a vistoria da Segurança for aprovada, o motorista também é ativado.

> **A aprovação é o que destrava tudo.** Sem `approvedAt`, o motorista nunca aparece em checklists nem como titular de veículo.

---

## 2. Estruturar Equipes

Menu **"Equipes"**.

1. **"Nova Equipe"** — nomeie (ex.: *Equipe Asfalto*, *Equipe Drenagem*).
2. **Selecione o encarregado responsável** (líder da equipe).
3. **Marque os membros** em dois blocos:
   - **Motoristas com login** (usuários cadastrados no sistema)
   - **Motoristas pré-cadastrados sem login** (vindos do Requerimento, antes de receberem acesso)
4. **Salvar** — o sistema propaga o `teamId` automaticamente para todos os membros e para o líder.

A partir disso:
- O **Encarregado** dessa equipe vê só os motoristas/veículos/checklists dela.
- O **Adm de Frota** também filtra pelas suas equipes nos relatórios.

> **Edite a equipe sempre que alguém entrar ou sair.** O `teamId` é atualizado em cascata.

---

## 3. Criar login para motorista aprovado

Menu **"Criar Login Motorista"** (ou `/users`).

**Bloco "Aprovados pelo DP · sem login"** — motoristas prontos para receber acesso.

Clique em **"Criar login"**:

- **Tab E-mail** ? quem usa: motoristas administrativos. Reset de senha pelo Firebase.
- **Tab Matrícula** ? quem usa: motoristas operacionais com matrícula da empresa (7 dígitos). Reset interno (você cria novo login).

Defina uma senha inicial e **entregue para o motorista**.

---

## 4. Editar / Ativar / Desativar usuários

Menu **"Usuários do Sistema"** (ou `/users`).

Você vê **todos os usuários** (motoristas, encarregados, frota, segurança, admin).

Para cada usuário:

- **Editar** (botão lápis): altera nome, telefone, função. O e-mail/login Firebase não muda.
- **Mudar perfil** (select): altera o role do usuário (ex.: promover motorista a encarregado).
- **Aprovar** (botão verde): aparece em usuários pendentes.
- **Desativar / Reativar** (botão vermelho/verde): bloqueia ou libera o acesso ao sistema.
  - Quando desativado, ao tentar logar, o usuário recebe: *"Acesso desativado. Procure o Departamento Pessoal."*
  - O registro fica preservado — só o acesso é bloqueado.

---

## 5. Bloco "Motoristas com login ativo"

Mostra todos os motoristas que já receberam acesso, com seu identificador (e-mail ou matrícula). Útil para conferência rápida.

---

## 6. Quem é quem

| Situação | Quem procurar |
|---|---|
| Veículo aprovado mas não tem template | Segurança do Trabalho |
| Veículo aprovado mas não está em uso | Administrador de Frota (precisa configurar e fazer Vistoria de Entrada) |
| Motorista desativou por engano | Você mesmo — clique em **"Reativar"** |
| Encarregado pedindo motorista que não aparece | Verificar se foi incluído na equipe dele (`/teams`) |
| Erros no sistema | Administrador TI |

---

**Bom trabalho e boa gestão de acessos!**
