# pi-todo-rail

A restrained, branch-aware Todo extension for [Pi](https://pi.dev). It keeps the current task visible above the editor, lets the agent advance verified work automatically, and gives the user a fast keyboard panel for corrections.

## Highlights

- **Branch-aware state** — Todo snapshots live in the Pi session, so forks and tree navigation restore the correct list.
- **Verified automatic progress** — The agent marks a step done only after implementation and verification.
- **Current-task rail** — The first unfinished item stays visible above the editor with progress and shortcuts.
- **Animated handoff** — A completed current item transitions through `x old` → `→ next` → `* next` in about 200ms.
- **Keyboard panel** — `/todo` opens a focused list for selecting, focusing, completing, and reopening items.
- **Plain-text transcript** — Tool results use compact ASCII receipts without decorative color or background bands.
- **Model/UI separation** — Model-facing tool content stays stable English and UI state is rendered from structured details.

## Install

From npm:

```bash
pi install npm:pi-todo-rail
```

From GitHub:

```bash
pi install git:github.com/j-joker/pi-todo-rail@v0.1.0
```

Try it for one run without installing:

```bash
pi -e npm:pi-todo-rail
```

Run `/reload` after changing between a local development copy and the installed package.

## Usage

Ask Pi to plan multi-step work, or manage tasks directly:

```text
/todo                         Open the interactive panel
/todo add <text>              Add a task
/todo list                    Print the current list
/todo done <ID>               Complete or reopen a task
/todo rm <ID>                 Remove a task
/todo clear-done              Remove completed tasks
/todo reset                   Reset the list after confirmation
```

### Panel controls

```text
↑ / ↓       Select
Enter       Set selected task as current
Space       Complete or reopen
Esc         Close
```

The panel uses distinct markers:

```text
> *  selected and current
  *  current
>    selected
  x  done
```

### Editor shortcuts

```text
Ctrl+N      Complete the current task
Ctrl+R      Return to the previous task
```

These shortcuts wrap the active Pi editor component. If another terminal workflow already owns either key, use the `/todo` panel instead.

## Agent tool

The extension registers a `todo` tool with these actions:

```text
list, add, update, start, done, block, remove, reorder, clear_done, replace
```

The current item is always the first unfinished Todo. Agent guidance requires `done` immediately after a step is implemented and verified; reopening remains user-controlled.

## Handoff animation

Task handoff is non-blocking and only runs when the previous current item has actually become done:

```text
x  Previous task
→  Next task
*  Next task
```

Disable motion when needed:

```bash
TODO_MOTION=0 pi
# Also honored: REDUCE_MOTION=1, PI_REDUCED_MOTION=1, CI, TERM=dumb
```

Session restore and tree navigation never animate.

## State model

State is persisted in structured tool-result details and manual `todo-state` session entries. No project files or external databases are created. Restoring a branch replays the latest valid snapshot for that branch.

## Development

Requires Node.js 22.19+ and Pi 0.80+.

```bash
git clone https://github.com/j-joker/pi-todo-rail.git
cd pi-todo-rail
npm install
npm test
pi -e .
```

Validate the npm tarball before release:

```bash
npm run pack:check
```

## Security

Pi extensions run with the user's full system permissions. Review extension source before installation. This package does not start network services, spawn subprocesses, or write external state.

## License

MIT
