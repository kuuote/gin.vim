import type { Denops } from "https://deno.land/x/denops_std@v4.0.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v4.0.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";
import { command as commandBare } from "../command/bare/command.ts";

export type Candidate = { path: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "reset",
      (denops, bufnr, range) =>
        doResetFile(denops, bufnr, range, gatherCandidates),
    );
  });
}

export async function doResetFile(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  await commandBare(denops, [
    "reset",
    "--quiet",
    "--",
    ...xs.map((x) => x.path),
  ]);
}
