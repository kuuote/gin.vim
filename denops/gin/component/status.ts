import type { Denops } from "https://deno.land/x/denops_std@v3.9.0/mod.ts";
import { Cache } from "https://deno.land/x/local_cache@1.0/mod.ts";
import { decodeUtf8 } from "../util/text.ts";
import { findWorktreeFromDenops } from "../git/worktree.ts";
import { execute } from "../git/process.ts";

type Data = {
  staged: number;
  unstaged: number;
  conflicted: number;
};

const cache = new Cache<string, Data>(100);

async function getData(
  denops: Denops,
): Promise<Data> {
  if (cache.has("data")) {
    return cache.get("data");
  }
  const worktree = await findWorktreeFromDenops(denops);
  const result = await getStatus(worktree);
  cache.set("data", result);
  return result;
}

async function getStatus(
  cwd: string,
): Promise<Data> {
  const stdout = await execute([
    "status",
    "--porcelain",
    "--ignore-submodules",
  ], {
    noOptionalLocks: true,
    cwd,
  });
  const statusCount: Data = {
    staged: 0,
    unstaged: 0,
    conflicted: 0,
  };
  for (const record of decodeUtf8(stdout).split("\n")) {
    const sign = record.slice(0, 2);
    if (sign.match(/^(?:DD|AU|UD|UA|DU|AA|UU)/)) {
      statusCount.conflicted += 1;
    } else if (sign === "??" || sign === "!!") {
      continue;
    } else if (sign.match(/^\S.$/)) {
      statusCount.staged += 1;
    } else if (sign.match(/^.\S$/)) {
      statusCount.unstaged += 1;
    }
  }
  return statusCount;
}

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "component:status:staged": async () => {
      const { staged } = await getData(denops);
      return staged === 0 ? "" : String(staged);
    },
    "component:status:unstaged": async () => {
      const { unstaged } = await getData(denops);
      return unstaged === 0 ? "" : String(unstaged);
    },
    "component:status:conflicted": async () => {
      const { conflicted } = await getData(denops);
      return conflicted === 0 ? "" : String(conflicted);
    },
    "component:status:preset:ascii": async () => {
      const result = await getData(denops);
      const staged = result.staged === 0 ? "" : "<" + result.staged;
      const unstaged = result.unstaged === 0 ? "" : ">" + result.unstaged;
      const conflicted = result.conflicted === 0 ? "" : "x" + result.conflicted;
      return [staged, unstaged, conflicted]
        .filter((s) => s.length != 0)
        .join(" ");
    },
    "component:status:preset:unicode": async () => {
      const result = await getData(denops);
      const staged = result.staged === 0 ? "" : "«" + result.staged;
      const unstaged = result.unstaged === 0 ? "" : "»" + result.unstaged;
      const conflicted = result.conflicted === 0 ? "" : "×" + result.conflicted;
      return [staged, unstaged, conflicted]
        .filter((s) => s.length != 0)
        .join(" ");
    },
  };
}
