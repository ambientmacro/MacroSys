# Manual do Administrador TI — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco em usuários, backup e ambiente.

---

## O que você faz no sistema

- Cria/edita/desativa **qualquer usuário** (exceção administrativa ao fluxo).
- Faz **Backup & Restauração** de dados (JSON/CSV/XLSX + ZIP com mídias).
- Configura ambiente Firebase (localhost autorizado, chaves `.env`).

---

## Suas telas

### 👤 Usuários (`/users`) — controle total
Criar usuário do zero (qualquer perfil), editar dados, ativar/desativar. Ao criar Motorista aqui, o sistema também cria o espelho em `drivers` (habilitando checklist na hora — exceção documentada).

### 💾 Backup & Restauração (`/backup`) — só TI
Um dos módulos mais poderosos. Recursos:
- **Contagem por coleção** em tempo real (11 coleções mapeadas).
- **Exportar cada coleção** em JSON / CSV / **XLSX**.
- **Filtro por Função (role)** na exportação XLSX de `users` — padrão "Todos", ou segmentado por Motorista / Encarregado / etc.
- **Empacotar mídias em .zip** — checkbox ligado por padrão em cada card. O XLSX vira `.zip` contendo a planilha + pasta `midias/<colecao>/<docId>/<campo>.<ext>` (fotos/CRLV/CNH/contrato convertidos de Base64 para binário). Nas células, o Base64 é substituído por caminho relativo.
- **Backup completo** — JSON único ou XLSX multi-abas (também com opção de ZIP+mídias).
- **Importar JSON** — restauração 1:1 preservando IDs originais (batches de 400 no Firestore).
- **Reset por coleção** ou **Reset banco completo** (com dupla confirmação e prompt de segurança).
- **Auditoria** em `audit_backups`: quem, quando, ação, formato, tamanho, quantidade, filtro, nº de mídias.

### 🎨 Temas (`/temas`), Templates, Equipes
Você tem acesso a tudo — use como fallback quando DP/Segurança/Performance/Medição não estiverem disponíveis.

### 🔗 Ambiente Firebase
- `.env` frontend com `VITE_FIREBASE_*`.
- `localhost` autorizado em Firebase → Auth → Authorized domains.
- Regras Firestore: sugestão em `/backup` (`audit_backups` deve ser imutável em produção).

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| **audit_backups** deve ser imutável (regra `allow update, delete: if false`). | Trilha auditável real. |
| Reset é destrutivo — sempre exporte JSON antes. | Backup fiel para restaurar. |
| Criar Motorista direto em `/users` é exceção — documente. | Fluxo padrão é via Requerimento. |

---

## FAQ rápido

**Quero exportar SÓ os motoristas com fotos.**
Card **Usuários** → dropdown "Função" = **Motorista** → checkbox "Empacotar mídias em .zip" **ligado** → **XLSX+ZIP** → você recebe `users_motorista_YYYY-MM-DD.zip` com planilha + pasta `midias/`.

**Excel estoura o limite de célula com Base64.**
No XLSX sem ZIP, o sistema omite colunas > 32k. No **XLSX+ZIP** (recomendado), o Base64 vira arquivo binário e a célula guarda o caminho relativo. Use sempre XLSX+ZIP quando houver anexos.

**Preciso resetar tudo para testes.**
`/backup` → **Resetar banco completo** → confirma → digita `APAGAR TUDO`. `audit_backups` é preservado.
