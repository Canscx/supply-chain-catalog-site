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

const problems = [];
const fail = (msg) => problems.push(msg);

const ID_RE = /^[a-z0-9-]+$/;
const chainNames = new Set();
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

  for (const ch of cat.chains) {
    if (!ID_RE.test(ch.id ?? "")) fail(`链条 id 非法: ${ch.id}`);
    if (chainIds.has(ch.id)) fail(`链条 id 重复: ${ch.id}`);
    chainIds.add(ch.id);

    if (!ch.name) fail(`链条缺名称: ${ch.id}`);
    if (chainNames.has(ch.name)) fail(`链条名重复: ${ch.name}`);
    chainNames.add(ch.name);

    if (!Array.isArray(ch.aliases)) fail(`链条别名必须是数组: ${ch.name}`);
    if (!Array.isArray(ch.stages)) fail(`链条环节必须是数组: ${ch.name}`);
  }
}

const total = [...chainIds].length;
if (catalog.totals?.chains !== total) {
  fail(`totals.chains 与实际不符: 声明 ${catalog.totals?.chains}，实际 ${total}`);
}
if (catalog.totals?.categories !== catalog.categories.length) {
  fail(`totals.categories 与实际不符: 声明 ${catalog.totals?.categories}，实际 ${catalog.categories.length}`);
}

// 敏感字段绝不能出现在公开数据里
const SENSITIVE = /万[0-9]|千[0-9]|起做量|渠道价|低消|利润率|保证金|受托提款/;
const hit = raw.match(SENSITIVE);
if (hit) fail(`疑似泄漏内部字段: ${hit[0]}`);

if (problems.length) {
  console.error("数据自检失败：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(`数据自检通过：${catalog.categories.length} 个品类 / ${total} 条链条`);
