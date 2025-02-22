import type { Denops } from "https://deno.land/x/denops_std@v4.0.0/mod.ts";
import * as path from "https://deno.land/std@0.171.0/path/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v4.0.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v4.0.0/function/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v4.0.0/mapping/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v4.0.0/variable/mod.ts";
import * as option from "https://deno.land/x/denops_std@v4.0.0/option/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.1.0/mod.ts";
import {
  builtinOpts,
  formatOpts,
  parse,
  validateOpts,
} from "https://deno.land/x/denops_std@v4.0.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v4.0.0/buffer/mod.ts";
import { normCmdArgs } from "../../util/cmd.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";
import { exec as execEdit } from "../edit/command.ts";

export type CommandOptions = {
  disableDefaultArgs?: boolean;
};

export async function command(
  denops: Denops,
  mods: string,
  args: string[],
  options: CommandOptions = {},
): Promise<void> {
  if (!options.disableDefaultArgs) {
    const defaultArgs = await vars.g.get(
      denops,
      "gin_patch_default_args",
      [],
    );
    unknownutil.assertArray(defaultArgs, unknownutil.isString);
    args = [...defaultArgs, ...args];
  }
  const [opts, _, residue] = parse(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    "opener",
    "no-head",
    "no-worktree",
    ...builtinOpts,
  ]);
  const [abspath] = parseResidue(residue);
  await exec(denops, abspath, {
    worktree: opts.worktree,
    noHead: "no-head" in opts,
    noWorktree: "no-worktree" in opts,
    opener: opts.opener,
    cmdarg: formatOpts(opts, builtinOpts).join(" "),
    mods,
  });
}

export type ExecOptions = {
  worktree?: string;
  noHead?: boolean;
  noWorktree?: boolean;
  opener?: string;
  cmdarg?: string;
  mods?: string;
};

export async function exec(
  denops: Denops,
  filename: string,
  options: ExecOptions,
): Promise<void> {
  const [verbose, disableDefaultMappings] = await batch.gather(
    denops,
    async (denops) => {
      await option.verbose.get(denops);
      await vars.g.get(
        denops,
        "gin_patch_disable_default_mappings",
        false,
      );
    },
  ) as [number, unknown];
  unknownutil.assertBoolean(disableDefaultMappings);

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });
  const abspath = path.isAbsolute(filename)
    ? filename
    : path.join(worktree, filename);

  const infoIndex = await execEdit(denops, abspath, {
    worktree,
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
  });

  let infoHead: buffer.OpenResult | undefined;
  if (!options.noHead) {
    infoHead = await execEdit(denops, abspath, {
      worktree,
      commitish: "HEAD",
      opener: "topleft vsplit",
      cmdarg: options.cmdarg,
      mods: options.mods,
    });
    await fn.win_gotoid(denops, infoIndex.winid);
  }

  let infoWorktree: buffer.OpenResult | undefined;
  if (!options.noWorktree) {
    infoWorktree = await buffer.open(denops, abspath, {
      opener: "botright vsplit",
      cmdarg: options.cmdarg,
      mods: options.mods,
    });
  }

  // HEAD
  if (infoHead) {
    await initHead(
      denops,
      infoHead.bufnr,
      infoIndex.bufnr,
      disableDefaultMappings,
    );
  }

  // INDEX
  await initIndex(
    denops,
    infoIndex.bufnr,
    infoHead?.bufnr,
    infoWorktree?.bufnr,
    disableDefaultMappings,
  );

  // WORKTREE
  if (infoWorktree) {
    await initWorktree(
      denops,
      infoWorktree.bufnr,
      infoIndex.bufnr,
      disableDefaultMappings,
    );
  }

  // edit | diffthis
  const winids = [infoIndex, infoHead, infoWorktree]
    .map((v) => v?.winid)
    .filter((v) => v) as number[];
  await batch.batch(denops, async (denops) => {
    for (const winid of winids) {
      await fn.win_execute(denops, winid, "diffthis", "silent!");
    }
  });

  // Focus INDEX
  await fn.win_gotoid(denops, infoIndex.winid);
}

function parseResidue(
  residue: string[],
): [string] {
  // GinPatch [{options}] {path}
  switch (residue.length) {
    case 1:
      return [residue[0]];
    default:
      throw new Error("Invalid number of arguments");
  }
}

async function initHead(
  denops: Denops,
  bufnr: number,
  bufnrIndex: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrIndex}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "dp",
          "<Plug>(gin-diffput)",
          {
            buffer: true,
          },
        );
      }
      await denops.cmd("silent! edit");
    });
  });
}

async function initWorktree(
  denops: Denops,
  bufnr: number,
  bufnrIndex: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrIndex}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      await mapping.map(
        denops,
        "<Plug>(gin-diffget)",
        `<Cmd>diffget ${bufnrIndex}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "dp",
          "<Plug>(gin-diffput)",
          {
            buffer: true,
          },
        );
        await mapping.map(
          denops,
          "do",
          "<Plug>(gin-diffget)",
          {
            buffer: true,
          },
        );
      }
      await denops.cmd("silent! edit");
    });
  });
}

async function initIndex(
  denops: Denops,
  bufnr: number,
  bufnrHead: number | undefined,
  bufnrWorktree: number | undefined,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      if (bufnrHead !== -1) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-l)",
          `<Cmd>diffget ${bufnrHead}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget)",
          "<Plug>(gin-diffget-l)",
          {
            buffer: true,
          },
        );
        if (!disableDefaultMappings) {
          await mapping.map(
            denops,
            "dol",
            "<Plug>(gin-diffget-l)",
            {
              buffer: true,
            },
          );
          await mapping.map(
            denops,
            "do",
            "<Plug>(gin-diffget)",
            {
              buffer: true,
            },
          );
        }
      }
      if (bufnrWorktree !== -1) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffput)",
          `<Cmd>diffput ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-r)",
          `<Cmd>diffget ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget)",
          "<Plug>(gin-diffget-r)",
          {
            buffer: true,
          },
        );
        if (!disableDefaultMappings) {
          await mapping.map(
            denops,
            "dp",
            "<Plug>(gin-diffput)",
            {
              buffer: true,
            },
          );
          await mapping.map(
            denops,
            "dor",
            "<Plug>(gin-diffget-r)",
            {
              buffer: true,
            },
          );
          await mapping.map(
            denops,
            "do",
            "<Plug>(gin-diffget)",
            {
              buffer: true,
            },
          );
        }
      }
      await denops.cmd("silent! edit");
    });
  });
}
