# supply-chain-catalog-site

企业供应链产品链条展示站。纯前端静态站，两个页面：首页与产品链条目录。无后端、无数据库、无第三方接口。

演示数据集为 16 个品类、114 条产品链条，用于展示品类筛选、别名检索与双主题能力。

## 快速开始

克隆后现场安装（注意工作目录是 `site/`，`package.json` 在这一层）：

```bash
git clone https://github.com/Canscx/supply-chain-catalog-site.git
cd supply-chain-catalog-site/site

npm ci             # 按 lockfile 精确安装；也可用 npm install
npm run dev        # 开发服务器 http://localhost:4321
```

构建与预览：

```bash
npm run check      # 数据自检，构建前必跑
npm run build      # 产出 site/dist/
npm run preview    # 预览构建产物
```

发布：把 `site/dist/` 整个目录传到任意静态服务器根目录即可，不需要 Node 进程。

## 技术选型

**Astro（静态输出）+ 原生 CSS + 少量原生 ES 模块**

| 选择 | 理由 | 代价 |
| --- | --- | --- |
| Astro | 数据要在首页索引、目录分组、检索三处复用，单一数据源在构建期生成 HTML，产物是纯静态文件 | 引入 Node 构建链 |
| 不用 React/Next | 全站只有「主题切换 + 筛选 + 折叠」三处交互，不值得背一个 hydration 运行时 | — |
| 不用 Tailwind | 需要对 OKLCH 色板、双主题、排版层级精确控制，手写自定义属性更直接 | — |

构建后 JS 总量约 8.7KB（未压缩）：首页脚本 3.9KB、目录脚本 3.8KB、共用检索 0.9KB。

## 目录结构

```
site/
  src/
    pages/index.astro        首页
    pages/catalog.astro      产品链条目录
    layouts/Base.astro       head / 主题引导 / skip link
    components/              Nav、Footer、ScopeMap、Thresholds、CooperationFlow
    data/catalog.json        链条数据
    data/catalog.ts          类型与检索工具
    data/thresholds.json     准入门槛数据
    data/thresholds.ts       准入门槛类型
    styles/tokens.css        设计令牌（色板、字号、间距、层级）
    styles/base.css          重置、排版、布局基础
    styles/components.css    组件样式
    scripts/theme.ts         主题读写
    scripts/nav.ts           导航滚动态
    scripts/search.ts        检索归一化
    scripts/inline.ts        首页筛选与业务范围块
    scripts/catalog.ts       目录页筛选与高亮
  scripts/verify-data.mjs    构建前数据自检
  public/                    favicon、robots.txt
```

## 数据格式

链条数据只改 `site/src/data/catalog.json`，准入门槛只改 `site/src/data/thresholds.json`，然后 `npm run check && npm run build`。

```json
{
  "categories": [
    {
      "id": "agri",
      "name": "农副产品",
      "chains": [
        {
          "id": "corn",
          "name": "玉米",
          "base": "玉米",
          "aliases": [],
          "stages": ["source", "settlement"]
        }
      ]
    }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定标识，小写字母数字短横线，全局唯一 |
| `name` | 展示名，直接用产品名（如「PCB电路板」），不带「·链条」后缀 |
| `base` | 检索与链接用的标准名；当前与 `name` 相同 |
| `aliases` | 其他叫法，**只参与搜索、不渲染** |
| `stages` | 该链条涉及的环节标识，无则留空数组 |

准入门槛数据按三段组织：`sections[].id` 固定为 `research-info`、`robot-drone`、`other`，每段含 `items`（材料清单）与 `shield`（对盾要求）。`shield` 用 `tiers` 表示银行分级，或用 `notes` 表示文字要求。

`npm run check` 会校验 id 格式与唯一性、展示名去重、每个品类非空、`totals` 与实际一致、链条名不带「·链条」后缀，以及公开数据中不含报价、交易金额与敏感字段；同时校验 `thresholds.json` 是否为固定的三段、每段材料数是否为 14 / 14 / 17。任一项不过直接非零退出，不会产出坏数据。

## 如何新增页面

在 `site/src/pages/` 加一个 `.astro` 文件即可，Astro 自动生成对应静态路由。共享导航与页脚从 `components/` 引入，主题与布局从 `layouts/Base.astro` 继承。

如需复用筛选逻辑，`scripts/search.ts` 的归一化函数可以直接 import。

## 检索设计

命中范围是**链条名 + 别名 + 隐藏检索词「链条」**。展示名已不带「·链条」后缀，但匹配时仍把「链条」算进去，所以旧写法继续有效。匹配前统一归一化：去掉空白与 `.` `·` `•` `-` `/` `、` `,` 这类分隔符，英文字母转小写。

因此下面几种写法都只命中同一条：

- `玉米`
- `玉米.链条`
- `玉米·链条`
- `玉米链条`

别名机制解决的是同一实体的不同叫法：数据里写「钢材（含螺纹钢）」，用户搜「螺纹钢」也能命中。

品类与关键词取**交集**。选了某个品类再搜不相关的词，结果是 0 条并显示空态，不会串到其他品类。

## 测试

47 项自动化检查（Chrome 无头 + CDP 驱动），覆盖三块：

**首页 24 项**：搜索栏 → 业务范围 → 结果行的 DOM 顺序；点品类后只剩该品类、计数正确、块收成一行、结果行不被吸附层遮挡；「换品类」展开后筛选不变；重复点同一品类幂等；搜索与品类取交集；清空筛选回到默认折叠态；深链还原；未知 category 回落全部；手机端默认折叠 8 个 + 展开按钮；桌面 3 行 17 格全可见；三档宽度无横向溢出；移动端触控 ≥44px。

**目录页 23 项**：三种分隔符写法各只命中 1 条；别名检索生效；无匹配空态；清空关键词保留分类；清空筛选回默认折叠；默认浅色、切换后跨页与刷新保持、禁用存储仍可当页切换；键盘 Tab 顺序完整；所有 button 有可读名称；表单有 label；每页一个 h1；`lang=zh-CN`；`prefers-reduced-motion` 生效。

**发布包 11 项**：8 个文件，无 source map、无原始资料、无敏感字段。

## 浏览器支持

现代浏览器（Chrome / Edge / Safari / Firefox 最近两个大版本）。使用了 OKLCH 颜色、`:has()` 选择器、`backdrop-filter`；不支持 `backdrop-filter` 时导航自动回退为实色背景。

## 文档

- [产品需求文档](docs/PRD.md)
- [视觉交互规格](docs/视觉交互规格.md)
