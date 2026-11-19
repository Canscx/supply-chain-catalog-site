#!/usr/bin/env node
/**
 * 构建前数据自检。任何一项不合格都以非零码退出，避免坏数据进产物。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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

if (!Array.isArray(catalog.categories) || catalog.categories.length === 0) {
  fail("categories 必须是非空数组");
}

for (const cat of catalog.categories ?? []) {
  if (!ID_RE.test(cat.id ?? "")) fail(`品类 id 非法: ${cat.id}`);
  if (categoryIds.has(cat.id)) fail(`品类 id 重复: ${cat.id}`);
  categoryIds.add(cat.id);

  if (!cat.name) fail(`品类缺名称: ${cat.id}`);
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

const FIRST_CATEGORIES = ["机器人", "无人机", "科技链条", "可变品", "可定制"];
if (catalog.categories.slice(0, 5).map((c) => c.name).join("|") !== FIRST_CATEGORIES.join("|")) {
  fail("前五个品类顺序应为机器人、无人机、科技链条、可变品、可定制");
}

const total = [...chainIds].length;
if (catalog.totals?.chains !== total) {
  fail(`totals.chains 与实际不符: 声明 ${catalog.totals?.chains}，实际 ${total}`);
}
if (catalog.totals?.categories !== catalog.categories.length) {
  fail(`totals.categories 与实际不符: 声明 ${catalog.totals?.categories}，实际 ${catalog.categories.length}`);
}

// 准入门槛：三段固定顺序与条数，防止漏项或错序。
const EXPECTED_SECTIONS = [
  { id: "research-info", count: 14 },
  { id: "robot-drone", count: 14 },
  { id: "other", count: 17 },
];
const sections = thresholds.sections;
const sectionIds = new Set();

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

    if (!Array.isArray(section.items) || section.items.length !== expected.count) {
      fail(`${section.id} 应有 ${expected.count} 项材料，实际 ${Array.isArray(section.items) ? section.items.length : "非数组"}`);
    } else {
      section.items.forEach((item, i) => {
        if (typeof item !== "string" || !item.trim()) fail(`${section.id} 第 ${i + 1} 项材料为空`);
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
