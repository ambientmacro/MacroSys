# Manual do Administrador TI — MACRO AMBIENTAL

> Guia rápido para quem mantém o sistema, cria usuários gestores e resolve casos especiais.

---

## Visão geral do seu papel

O Administrador TI tem **acesso completo** ao sistema. Use raramente, apenas para:

1. **Configurar usuários iniciais** (primeiros gestores: DP, Encarregados, Frota, Segurança).
2. **Resolver casos especiais** (alterações de perfil, exclusões).
3. **Excluir registros** quando necessário (somente você tem essa permissão).
4. **Apoiar o DP** em casos administrativos urgentes.

---

## 1. Usuários do Sistema

Menu **"Usuários"** (`/users`).

Você vê **todos os usuários** do sistema, organizados em 3 blocos:

- **Aprovados pelo DP · sem login** — motoristas prontos para receber acesso.
- **Motoristas com login ativo** — motoristas que já têm acesso, mostrando identificador (e-mail ou matrícula).
- **Todos os usuários do sistema** — lista completa (motoristas, encarregados, frota, dp, segurança, admin).

### Ações disponíveis para cada usuário

- **Editar (lápis)** — altera nome, telefone, função.
- **Mudar perfil (select)** — promove/rebaixa o usuário entre perfis. Cuidado com isso.
- **Aprovar** — para usuários pendentes (não aprovados pelo DP).
- **Desativar / Reativar** — alterna o status `APPROVED` ? `REJECTED`. Usuários desativados são bloqueados no login.
- **Excluir (lixeira vermelha)** — **somente você** tem essa opção. Remove o registro definitivamente.

---

## 2. Criar usuário do zero (exceção administrativa)

Botão **"Novo usuário"** no topo da tela `/users`.

Diferente do fluxo padrão (Requerimento ? DP aprova), aqui você cria o usuário direto:

1. Preencha nome, e-mail, senha, telefone.
2. **Escolha o perfil** (todos os 6 perfis estão disponíveis para você).
3. **Salve**.

> **Quando o perfil escolhido é Motorista**, o sistema cria automaticamente o espelho na coleção operacional `drivers` — o motorista já fica habilitado para checklists.

Use isso para:
- Cadastrar o primeiro DP / Encarregado / Frota / Segurança do sistema.
- Criar contas administrativas urgentes.
- Resolver casos onde o fluxo padrão não cabe.

> Para qualquer entrada NORMAL de motorista, use o fluxo padrão (Requerimento) — não crie do zero.

---

## 3. Criar login para motorista aprovado

Mesma função do DP e do Encarregado: você vê o bloco "Aprovados pelo DP · sem login" e pode clicar em **"Criar login"** para qualquer motorista (não está limitado a equipes).

Modal abre com 2 opções: **E-mail** ou **Matrícula 7 dígitos**.

---

## 4. Templates e Equipes

Você tem acesso a `/templates` (Segurança) e `/teams` (DP). Use quando precisar fazer ajuste técnico ou administrativo.

---

## 5. Acompanhar o sistema

- **Dashboard** mostra resumo geral.
- **Relatórios da Frota** acessível também por você (`/frota/relatorios`).
- **Lista de Veículos**, **Motoristas**, **Checklists** acessíveis.

---

## 6. Casos especiais que costumam aparecer

| Situação | O que fazer |
|---|---|
| Motorista perdeu acesso e ninguém consegue redefinir | Você cria um novo login pra ele. |
| Encarregado pediu para mudar o perfil de um membro | Use o select de role na linha do usuário. |
| DP pediu ajuda em casos administrativos | Você tem mesma permissão de gestão de usuários que o DP. |
| Cadastro errado precisa ser apagado | Só você pode excluir (lixeira vermelha). |
| Backup do banco | Painel do Firebase Console (fora deste sistema). |
| Mudança de configuração de ambiente | Arquivo `.env` (consulte o time de desenvolvimento). |

---

## 7. Boas práticas

- **Não use o Admin TI no dia a dia.** Cada gestor deve ter o perfil correto e usar suas próprias telas. O Admin TI é "exceção" — quanto menos for usado, melhor a rastreabilidade.
- **Desativar é melhor que excluir.** Preserva o histórico para auditoria.
- **Registre quem você criou e por quê** (anotação fora do sistema).
- **Para crises**: lembre-se que o DP também tem permissões amplas — você não precisa fazer tudo sozinho.

---

**Bom trabalho e bom suporte!**
