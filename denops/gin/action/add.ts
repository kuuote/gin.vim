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
      "add",
      (denops, bufnr, range) =>
        doAdd(denops, bufnr, range, [], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "add:intent-to-add",
      (denops, bufnr, range) =>
        doAdd(denops, bufnr, range, ["--intent-to-add"], gatherCandidates),
    );
  });
}

async function doAdd(
  denops: Denops,
  bufnr: number,
  range: Range,
  extraArgs: string[],
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  await commandBare(denops, [
    "add",
    "--ignore-errors",
    "--force",
    ...extraArgs,
    "--",
    ...xs.map((x) => x.path),
  ]);
}
