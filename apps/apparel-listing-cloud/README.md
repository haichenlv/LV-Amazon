# 亚马逊服装上架工作台（Cloudflare）

将本地的 Amazon US 服装上架流程迁移为私有云端工作台。每个批量 Excel 数据行生成一份独立 XLSM，上架文件基于管理员上传的 XY 原始模板进行 OOXML 数据行替换，保留模板宏和账户相关文件。

## 已实现

- 读取现有 37 列中文批量产品信息 Excel。
- 每行一个产品，按颜色 × 尺码生成父子变体。
- 用户提供的白底图直接采用，不打开、不校验；按“产品简称 + 颜色”文件名配对。
- 原图下载后重新托管，Main / Swatch / Other 按最新规则分流。
- 没有白底图时调用可配置的抠图服务；未配置时给出明确错误。
- 使用私有 R2 保存 XY 模板和生成文件，公开 R2 路径仅用于 Amazon 图片。
- D1 保存任务、产品、校验结果和下载记录。
- 固化 SHIRT、尺码、报价、库存物流、Compliance 空值、Shipping Template 等规则。
- 网页端上传、进度/错误查看、XLSM 下载、规则查看和 XY 模板更新。

## Cloudflare 资源

```bash
npx wrangler d1 create amazon-apparel-listing
npx wrangler r2 bucket create amazon-apparel-listing-files
```

把 D1 返回的 `database_id` 写入 `wrangler.jsonc`，然后：

```bash
npx wrangler d1 migrations apply amazon-apparel-listing --remote
npx wrangler secret put APP_TOKEN
# 可选：自动抠图服务
npx wrangler secret put BG_REMOVAL_ENDPOINT
npx wrangler secret put BG_REMOVAL_API_KEY
npm run deploy
```

`APP_TOKEN`、图床密码、第三方 API Key 和 XY 原始模板均不得提交到公开仓库。

## 白底图命名

推荐使用：`产品简称__颜色.jpg`，例如：

- `Fallbaidi__Orange.jpg`
- `Fallbaidi__Black.png`

单产品任务也可只在文件名中包含颜色。系统只按文件名配对，不读取或校验图片内容。
