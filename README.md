# ai-chat-backend

基于 **OpenNext** + **Next.js 16** 构建的 AI 聊天应用，目标部署到 **Cloudflare Workers**，使用：

- **D1**：SQLite 数据库（会话、消息持久化）
- **R2**：对象存储（未来支持文件/图片上传）
- **AI Gateway** + Workers AI：LLM 统一调用、限流、日志、BYOK

目录结构参考 `../ai-image-maker` 项目风格。

## 快速开始

```bash
pnpm install
pnpm dev          # 本地 Next.js（无真实 Cloudflare 绑定）
pnpm cf:build     # 构建 OpenNext worker
pnpm preview      # 本地预览（模拟 Workers 环境）
pnpm deploy       # 部署到 Cloudflare
```

## Cloudflare 准备工作（必须）

1. **创建 D1 数据库**
   ```bash
   npx wrangler d1 create ai-chat
   ```
   把返回的 `database_id` 填入 [wrangler.jsonc](wrangler.jsonc) 的 `d1_databases[0].database_id`

2. **创建 R2 Bucket**（可选，文件上传用）
   ```bash
   npx wrangler r2 bucket create ai-chat-uploads
   ```
   更新 wrangler.jsonc 中的 bucket_name

3. **创建 AI Gateway**（推荐）
   - Cloudflare Dashboard → AI → AI Gateway → 创建 Gateway（id 建议 `ai-chat`）
   - 在 wrangler.jsonc 里设置 `vars.AI_GATEWAY_ID`

4. **配置模型 Key**
   - 在 Cloudflare AI Gateway 中添加 Provider（OpenAI / Anthropic / Google）
   - 或直接在 `vars.OPENAI_API_KEY` 填入密钥（仅测试用，生产建议用 Gateway 托管密钥）

5. **执行数据库迁移**
   ```bash
   npx wrangler d1 execute ai-chat --file=./migrations/001_init.sql --remote
   ```

6. **生成类型定义**
   ```bash
   pnpm cf-typegen
   ```

## 本地开发使用真实绑定

`next.config.ts` 已启用 `remoteBindings: true`，`pnpm dev` 时会尝试连接远程 D1/R2/AI。

## 主要目录

```
app/
  api/
    chat/                 # 核心流式聊天接口（保存到 D1）
    conversations/        # 会话 CRUD
    r2/[...key]/          # R2 文件代理
  page.tsx                # 主聊天界面
lib/
  d1.js                   # D1 辅助函数
  r2.js                   # R2 辅助函数
  env.js                  # 环境变量统一读取
  ai/gateway-chat.js      # AI Gateway + Workers AI 聊天封装（支持流式）
migrations/               # D1 SQL 迁移文件
components/chat/          # 聊天 UI 组件
wrangler.jsonc            # Cloudflare 配置（D1/R2/AI 绑定）
open-next.config.ts
```

## 后续扩展建议

- 接入真实用户系统（D1 users 表 + JWT / NextAuth / Cloudflare Access）
- 支持多模态（图片上传 → R2 → vision 模型）
- 增加工具调用 / Function calling
- 消息点赞、分享、导出
- 速率限制 + 额度控制（D1 记录用量）

## 部署命令

```bash
pnpm cf:build && opennextjs-cloudflare deploy
```

或使用 GitHub Actions + Wrangler 自动部署。
