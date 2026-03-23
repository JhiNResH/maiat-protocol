## Spec: Monorepo Restructure

**Goal:** 把 maiat-protocol 從 "root = Next.js app + everything" 重構成乾淨的 monorepo，讓外人一眼看懂 codebase 結構。

**現狀問題：**
- 99 個 API routes + 50 個 lib files + 37 個 components + contracts 全在 root
- tsc 跑到 OOM（整個 project 一起 compile）
- 新人看 repo 會懵
- cre/、cre-project/、PR155_updated.ts、run-indexer.mjs 等垃圾文件散在 root

---

### Target Structure

```
maiat-protocol/
├── apps/
│   └── web/                    ← Next.js app (移過去)
│       ├── src/
│       │   ├── app/            ← pages + API routes (現有 src/app/)
│       │   ├── components/     ← 現有 src/components/
│       │   ├── hooks/          ← 現有 src/hooks/
│       │   └── lib/            ← 現有 src/lib/
│       ├── public/             ← 現有 public/
│       ├── prisma/             ← 現有 prisma/
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── package.json        ← Next.js deps only
│       └── vercel.json
├── contracts/                  ← 不動（已經獨立 foundry.toml）
│   ├── src/
│   ├── test/
│   └── foundry.toml
├── packages/                   ← 已有的 SDK/plugins，不動
│   ├── sdk/
│   ├── guard/
│   ├── mcp-server/
│   ├── agentkit-plugin/
│   ├── elizaos-plugin/
│   ├── game-plugin/
│   ├── virtuals-plugin/
│   ├── maiat-evaluator-node/
│   ├── maiat-evaluator-py/
│   ├── wadjet/
│   └── landing/
├── scripts/                    ← 保留（indexer scripts 等）
├── docs/                       ← 保留
├── tests/                      ← 保留（root-level integration tests）
├── package.json                ← root workspace config (workspaces: ["apps/*", "packages/*"])
├── README.md
├── LICENSE
└── .gitignore
```

### 執行步驟

1. **清理垃圾文件**
   - 刪除：`cre/`, `cre-project/`, `PR155_updated.ts`, `run-indexer.mjs`, `run-indexer.ts`, `FAIRSCALE_BOUNTY_README.md`, `Procfile`
   - 移動到 apps/web/：`SKILL.md`, `CLAUDE.md` (或刪除)

2. **建立 apps/web/ 目錄**
   - 移動 `src/` → `apps/web/src/`
   - 移動 `public/` → `apps/web/public/`
   - 移動 `prisma/` → `apps/web/prisma/`
   - 移動 `next.config.ts` → `apps/web/next.config.ts`
   - 移動 `tailwind.config.ts` → `apps/web/tailwind.config.ts`
   - 移動 `postcss.config.js` → `apps/web/postcss.config.js`
   - 移動 `vercel.json` → `apps/web/vercel.json`
   - 移動 `vitest.config.ts` → `apps/web/vitest.config.ts`
   - 移動 `eslint.config.mjs` → `apps/web/eslint.config.mjs`
   - 複製 relevant deps 到 `apps/web/package.json`

3. **更新 root package.json**
   - `workspaces: ["apps/*", "packages/*"]`
   - 只保留 workspace-level devDeps（prettier, eslint 等）
   - 移除 Next.js 相關 deps

4. **更新 tsconfig**
   - Root tsconfig: 只有 references
   - apps/web/tsconfig.json: Next.js specific config
   - 修復 `@/` alias 指向 `apps/web/src/`

5. **更新 Vercel 配置**
   - Root Directory 設為 `apps/web`
   - 或用 `vercel.json` 的 `rootDirectory` field

6. **驗證**
   - `cd apps/web && npm run build` passes
   - `cd contracts && forge build` passes
   - Vercel preview deploy works
   - All existing API routes accessible

### Acceptance Criteria

- [ ] Root 目錄乾淨：只有 apps/, packages/, contracts/, scripts/, docs/, tests/, config files
- [ ] `apps/web/` 能獨立 `npm run dev` + `npm run build`
- [ ] contracts/ 不動，`forge test` 正常
- [ ] packages/* 不動，各自 build 正常
- [ ] 所有 `@/` import paths 正確
- [ ] Vercel deploy 正常（preview URL works）
- [ ] git history 保留（用 git mv，不是 delete + create）
- [ ] README 更新，說明 monorepo 結構

### Out of Scope

- 不拆 API routes 成獨立 service（之後再做）
- 不改 packages/* 的結構
- 不改 contracts/ 結構
- 不升級任何 dependency
