#!/usr/bin/env node
/**
 * 构建前数据自检。任何一项不合格都以非零码退出，避免坏数据进产物。
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, "../src/data/catalog.json"), "utf8");
const catalog = JSON.parse(raw);
const thresholdsRaw = readFileSync(resolve(here, "../src/data/thresholds.json"), "utf8");
const thresholds = JSON.parse(thresholdsRaw);

const problems = [];
const fail = (msg) => problems.push(msg);

const ID_RE = /^[a-z0-9-]+$/;
const chainIds = new Set();
const categoryIds = new Set();
const categoryEmoji = new Map();

if (!Array.isArray(catalog.categories) || catalog.categories.length === 0) {
  fail("categories 必须是非空数组");
}

for (const cat of catalog.categories ?? []) {
  if (!ID_RE.test(cat.id ?? "")) fail(`品类 id 非法: ${cat.id}`);
  if (categoryIds.has(cat.id)) fail(`品类 id 重复: ${cat.id}`);
  categoryIds.add(cat.id);

  if (!cat.name) fail(`品类缺名称: ${cat.id}`);

  if (typeof cat.emoji !== "string" || !cat.emoji.trim()) {
    fail(`品类缺 emoji: ${cat.id}`);
  } else if (categoryEmoji.has(cat.emoji)) {
    fail(`品类 emoji 重复: ${cat.id} / ${categoryEmoji.get(cat.emoji)}`);
  } else {
    categoryEmoji.set(cat.emoji, cat.id);
  }

  if (!Array.isArray(cat.chains) || cat.chains.length === 0) {
    fail(`品类无链条: ${cat.id}`);
    continue;
  }

  const namesInCategory = new Set();
  for (const ch of cat.chains) {
    if (!ID_RE.test(ch.id ?? "")) fail(`链条 id 非法: ${ch.id}`);
    if (chainIds.has(ch.id)) fail(`链条 id 重复: ${ch.id}`);
    chainIds.add(ch.id);

    if (!ch.name) fail(`链条缺名称: ${ch.id}`);
    if (ch.name === "机器人零部件") fail("机器人零部件已按要求删除");
    if (ch.name?.includes("·链条")) fail(`链条名不应带「·链条」后缀: ${ch.name}`);
    if (ch.name !== ch.base) fail(`链条 name 与 base 不一致: ${ch.name}`);
    if (namesInCategory.has(ch.name)) fail(`同一品类内链条名重复: ${cat.id}/${ch.name}`);
    namesInCategory.add(ch.name);

    if (!Array.isArray(ch.aliases)) fail(`链条别名必须是数组: ${ch.name}`);
    if (!Array.isArray(ch.stages)) fail(`链条环节必须是数组: ${ch.name}`);
  }
}

const FIRST_CATEGORIES = ["科技链条", "智能装备", "新能源", "电子产品", "农副产品"];
if (catalog.categories.slice(0, 5).map((c) => c.name).join("|") !== FIRST_CATEGORIES.join("|")) {
  fail("前五个品类顺序应为科技链条、智能装备、新能源、电子产品、农副产品");
}

// 已合并/删除的旧品类不能再出现。
for (const removed of ["robot", "drone", "service"]) {
  if (categoryIds.has(removed)) fail(`旧品类 id 不应存在: ${removed}`);
}

// 科技链条前六项是固定口径，顺序不能漂移。
const techCategory = catalog.categories.find((c) => c.id === "tech");
const TECH_FIRST = ["信息服务", "软件开发", "研发技术", "技术服务", "AI算力", "系统运维"];
if (!techCategory) {
  fail("缺少科技链条品类");
} else {
  const actual = techCategory.chains.slice(0, TECH_FIRST.length).map((c) => c.name);
  if (actual.join("|") !== TECH_FIRST.join("|")) {
    fail(`科技链条前六项应为 ${TECH_FIRST.join("、")}，实际 ${actual.join("、")}`);
  }
  if (techCategory.chains.some((c) => c.name === "机器人" || c.name === "无人机")) {
    fail("科技链条中不应再出现机器人、无人机");
  }
}

const household = catalog.categories.find((c) => c.id === "household");
if (!household?.chains.some((c) => c.name === "家电（小家电）")) {
  fail("家电与日用品类缺少「家电（小家电）」小类");
}

const total = [...chainIds].length;
if (catalog.totals?.chains !== total) {
  fail(`totals.chains 与实际不符: 声明 ${catalog.totals?.chains}，实际 ${total}`);
}
if (catalog.totals?.categories !== catalog.categories.length) {
  fail(`totals.categories 与实际不符: 声明 ${catalog.totals?.categories}，实际 ${catalog.categories.length}`);
}

// 准入门槛：唯一一段，固定段名与条数，防止漏项或错序。
const EXPECTED_SECTIONS = [
  { id: "research-info", name: "全部链条准入门槛", count: 14 },
];
const sections = thresholds.sections;
const sectionIds = new Set();
const DOWNLOAD_FILE_RE = /^[a-z0-9-]+\.(docx|xlsx|pdf)$/;
let downloadCount = 0;

if (!Array.isArray(sections) || sections.length !== EXPECTED_SECTIONS.length) {
  fail(`thresholds.sections 应为 ${EXPECTED_SECTIONS.length} 段，实际 ${Array.isArray(sections) ? sections.length : "非数组"}`);
} else {
  EXPECTED_SECTIONS.forEach((expected, index) => {
    const section = sections[index];
    if (!section || section.id !== expected.id) {
      fail(`第 ${index + 1} 段 id 应为 ${expected.id}，实际 ${section?.id}`);
      return;
    }
    if (!ID_RE.test(section.id)) fail(`准入门槛段 id 非法: ${section.id}`);
    if (sectionIds.has(section.id)) fail(`准入门槛段 id 重复: ${section.id}`);
    sectionIds.add(section.id);
    if (!section.name) fail(`准入门槛缺段名: ${section.id}`);
    if (section.name !== expected.name) {
      fail(`第 ${index + 1} 段名应为「${expected.name}」，实际「${section.name}」`);
    }

    if (!Array.isArray(section.items) || section.items.length !== expected.count) {
      fail(`${section.id} 应有 ${expected.count} 项材料，实际 ${Array.isArray(section.items) ? section.items.length : "非数组"}`);
    } else {
      section.items.forEach((item, i) => {
        const where = `${section.id} 第 ${i + 1} 项`;
        const text = typeof item === "string" ? item : item?.text;
        if (typeof text !== "string" || !text.trim()) fail(`${where}材料为空`);
        if (typeof item === "string") return;

        const downloads = item.downloads;
        if (downloads === undefined) return;
        if (!Array.isArray(downloads) || downloads.length === 0) {
          fail(`${where}的 downloads 必须是非空数组`);
          return;
        }
        downloads.forEach((dl, j) => {
          const label = `${where} 第 ${j + 1} 个下载`;
          if (!dl?.label || !dl?.file || !dl?.saveAs) fail(`${label}缺 label/file/saveAs`);
          if (!DOWNLOAD_FILE_RE.test(dl?.file ?? "")) fail(`${label}的 file 非法: ${dl?.file}`);
          const ext = (name) => String(name ?? "").slice(String(name ?? "").lastIndexOf("."));
          if (ext(dl?.saveAs) !== ext(dl?.file)) fail(`${label}的 saveAs 扩展名与 file 不一致`);
          if (!existsSync(join(here, "../public/downloads", dl.file))) {
            fail(`${label}的文件不存在: site/public/downloads/${dl.file}`);
          }
          downloadCount += 1;
        });
      });
    }

    const shield = section.shield;
    if (!shield || !shield.title) fail(`${section.id} 缺「对盾的要求」标题`);
    const hasTiers = Array.isArray(shield?.tiers) && shield.tiers.length > 0;
    const hasNotes = Array.isArray(shield?.notes) && shield.notes.length > 0;
    if (!hasTiers && !hasNotes) fail(`${section.id} 的 shield 必须包含 tiers 或 notes`);

    if (hasTiers) {
      shield.tiers.forEach((tier, i) => {
        if (!tier?.label || !tier?.text) fail(`${section.id} 第 ${i + 1} 个银行分级缺 label/text`);
      });
    }
    if (hasNotes) {
      shield.notes.forEach((note, i) => {
        if (typeof note !== "string" || !note.trim()) fail(`${section.id} 第 ${i + 1} 条对盾要求为空`);
      });
    }
  });
}

if (downloadCount === 0) fail("准入门槛没有任何模板下载项");

// 已删除的材料说明不得回流。
const thresholdText = JSON.stringify(sections);
for (const removed of ["贸易链", "营业执照有变更需要去银行基本户更新资料", "国企不需要", "2张明细表"]) {
  if (thresholdText.includes(removed)) fail(`准入门槛仍含已删除内容：${removed}`);
}

const totalThresholdItems = Array.isArray(sections)
  ? sections.reduce((n, section) => n + (Array.isArray(section.items) ? section.items.length : 0), 0)
  : 0;

// 敏感字段绝不能出现在公开数据里
const SENSITIVE = /万[0-9]|千[0-9]|起做量|渠道价|低消|利润率|保证金|受托提款/;
for (const [name, text] of [
  ["catalog.json", raw],
  ["thresholds.json", thresholdsRaw],
]) {
  const hit = text.match(SENSITIVE);
  if (hit) fail(`疑似泄漏内部字段（${name}）: ${hit[0]}`);
}

if (problems.length) {
  console.error("数据自检失败：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(
  `数据自检通过：${catalog.categories.length} 个品类 / ${total} 条链条 / ${EXPECTED_SECTIONS.length} 组准入门槛（${totalThresholdItems} 项）`
);
