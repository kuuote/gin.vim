import type { Denops } from "https://deno.land/x/denops_std@v4.0.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v4.0.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";
import { command as commandBare } from "../command/bare/command.ts";

export type Candidate = { commit: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      `cherry-pick`,
      (denops, bufnr, range) =>
        doCherryPick(denops, bufnr, range, "", gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      `cherry-pick:1`,
      (denops, bufnr, range) =>
        doCherryPick(denops, bufnr, range, "1", gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      `cherry-pick:2`,
      (denops, bufnr, range) =>
        doCherryPick(denops, bufnr, range, "2", gatherCandidates),
    );
  });
}

async function doCherryPick(
  denops: Denops,
  bufnr: number,
  range: Range,
  mainline: "" | "1" | "2",
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const x = xs.at(0);
  if (!x) {
    return;
  }
  await commandBare(denops, [
    "cherry-pick",
    ...(mainline ? [] : ["--mainline", mainline]),
    x.commit,
  ]);
}
