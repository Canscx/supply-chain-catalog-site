# supply-chain-catalog-site

企业供应链产品链条展示站。两个页面：首页与产品链条目录。页面为静态 HTML；「我要合作」咨询表单使用一个单文件 PHP 接口，写入 CSV 并发送企业微信群机器人通知。无数据库、无 Node 常驻进程。

演示数据集为 20 个品类、144 条产品链条（含跨品类重复展示），用于展示品类筛选、别名检索与双主题能力。

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
npm run preview    # 预览构建产物（只预览静态页面，不执行 PHP）
```

> `npm run preview` 只用于看页面；咨询表单的 `api/*.php` 需要 PHP 环境，预览模式下提交会失败。

发布：把 `site/dist/` 整个目录传到宝塔 PHP 项目根目录即可。页面仍是静态 HTML；咨询表单依赖同目录 `api/consult.php`（PHP 7.4+），不需要 Node 进程。部署细节见 [部署-咨询表单](docs/部署-咨询表单.md)。

## 技术选型

**Astro（静态输出）+ 原生 CSS + 少量原生 ES 模块**

| 选择 | 理由 | 代价 |
| --- | --- | --- |
| Astro | 数据要在首页索引、目录分组、检索三处复用，单一数据源在构建期生成 HTML，产物是纯静态文件 | 引入 Node 构建链 |
| 不用 React/Next | 全站只有「主题切换 + 筛选 + 折叠」三处交互，不值得背一个 hydration 运行时 | — |
| 不用 Tailwind | 需要对 OKLCH 色板、双主题、排版层级精确控制，手写自定义属性更直接 | — |

构建后 JS 总量约 19.8KB（未压缩）：首页主包 6.5KB、目录主包 3.4KB、咨询弹窗共用 9.8KB。

## 目录结构

```
site/
  src/
    pages/index.astro        首页
    pages/catalog.astro      产品链条目录
    layouts/Base.astro       head / 主题引导 / skip link
    components/              Nav、Footer、ScopeMap、Thresholds、CooperationFlow、AboutUs、ContactUs、ConsultWidget
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
    scripts/copy.ts          联系方式点击复制
    scripts/consult.ts       我要合作弹窗与提交
  scripts/verify-data.mjs    构建前数据自检
  public/                    favicon、robots.txt
  public/api/consult.php     咨询提交接口
  public/api/leads.php       CSV 下载（带口令）
  public/api/config.example.php  接口配置模板
  public/api/cacert.pem          企业微信 HTTPS CA 证书
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

同一条基础产品可以进入多个品类：可以同名共存（如「机器人」同时出现在机器人和科技链条），也可以用不同展示名建立多条记录（如「石墨烯」「石墨烯（变品）」「石墨烯（定制）」）；同一品类内 `name` 唯一。

准入门槛数据按三段组织：`sections[].id` 固定为 `research-info`、`robot-drone`、`other`，每段含 `items`（材料清单）与 `shield`（对盾要求）。`shield` 用 `tiers` 表示银行分级，或用 `notes` 表示文字要求。

`npm run check` 会校验 id 格式与唯一性、展示名去重、每个品类非空、`totals` 与实际一致、链条名不带「·链条」后缀，以及公开数据中不含报价、交易金额与敏感字段；同时校验 `thresholds.json` 是否为固定的三段、每段材料数是否为 14 / 14 / 17。任一项不过直接非零退出，不会产出坏数据。

## 咨询表单与企微通知

首页和目录页的「我要合作」入口会打开咨询弹窗。提交后：

1. `api/consult.php` 校验字段；
2. 追加写入 `consult-data/consultations.csv`（UTF-8 BOM，Excel 可直接打开）；
3. 通过企业微信群机器人 Webhook 发送一条 markdown 通知（字段名加粗）；
4. 返回成功或字段错误。

服务器配置在 `api/config.php`，从 `api/config.example.php` 复制，填入群机器人 Webhook 和 CSV 下载口令。该文件、`企微bot-webhook.txt`、`consult-data/` 都已加入 `.gitignore`，不要提交。

完整宝塔部署步骤、CSV 位置、Webhook 创建方法和故障排查见 [部署-咨询表单](docs/部署-咨询表单.md)。

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

自动化检查（Chrome 无头 + CDP 驱动），覆盖四块：

**首页 26 项**：搜索栏 → 业务范围 → 结果行的 DOM 顺序；点品类后只剩该品类、计数正确、块收成一行、结果行不被吸附层遮挡；「换品类」展开后筛选不变；重复点同一品类幂等；搜索与品类取交集；清空筛选回到默认折叠态；深链还原；未知 category 回落全部；手机端默认折叠 8 个 + 展开按钮；桌面 4 行 21 格全可见；关于我们/联系我们内容与公司地址；公司名和地址点击复制及提示；五个区块标题居中且 19px；三档宽度无横向溢出；移动端触控 ≥44px。

**目录页 23 项**：三种分隔符写法各只命中 1 条；别名检索生效；无匹配空态；清空关键词保留分类；清空筛选回默认折叠；默认浅色、切换后跨页与刷新保持、禁用存储仍可当页切换；键盘 Tab 顺序完整；所有 button 有可读名称；表单有 label；每页一个 h1；`lang=zh-CN`；`prefers-reduced-motion` 生效。

**发布包**：无 source map、无原始资料、无敏感字段；api 目录只包含接口文件、`.htaccess`、CA 证书与空配置模板，不包含 `config.php` 与 CSV。

**咨询表单 21 项**：两页入口、桌面悬浮胶囊/手机底部条、6 个品类胶囊、选中同步、定制展开、空表单错误、合法提交成功、ESC/遮罩/关闭按钮、关闭后状态恢复、深色主题、无横向溢出。

## 浏览器支持

现代浏览器（Chrome / Edge / Safari / Firefox 最近两个大版本）。使用了 OKLCH 颜色、`:has()` 选择器、`backdrop-filter`、原生 `dialog`；不支持 `backdrop-filter` 时导航自动回退为实色背景，不支持 `dialog` 时咨询入口仍可跳转联系我们。

## 文档

- [产品需求文档](docs/PRD.md)
- [视觉交互规格](docs/视觉交互规格.md)
