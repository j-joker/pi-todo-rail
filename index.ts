import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";
import { formatTodoContext } from "./context.ts";
import { TodoPanel, type TodoPanelAction } from "./panel.ts";
import { type Todo, TodoStore } from "./state.ts";
import { registerTodoTool } from "./tool.ts";
import { clearTodoWidget, updateTodoWidget } from "./widget.ts";

function textList(todos: readonly Todo[]): string {
	if (todos.length === 0) return "No todos. Use /todo add <text>, or ask Pi to break down the work.";
	const done = todos.filter((todo) => todo.done).length;
	const currentId = todos.find((todo) => !todo.done)?.id;
	const rows = todos.map((todo) => {
		const marker = todo.done ? "x" : todo.id === currentId ? "*" : " ";
		return `${marker} #${todo.id} ${todo.text}${todo.note ? ` (${todo.note})` : ""}`;
	});
	return `Todos ${done}/${todos.length}\n${rows.join("\n")}`;
}

export default function todoExtension(pi: ExtensionAPI): void {
	const store = new TodoStore();

	function refreshWidget(ctx: ExtensionContext, animate = true): void {
		updateTodoWidget(ctx, store.getAll(), { animate });
	}

	function persistManualChange(ctx: ExtensionContext): void {
		pi.appendEntry("todo-state", store.getSnapshot());
		refreshWidget(ctx);
	}

	function completeCurrent(ctx: ExtensionContext): void {
		const current = store.current();
		if (!current) {
			ctx.ui.notify(store.getAll().length === 0 ? "No todos." : "All todos are done.", "info");
			return;
		}

		store.setDone(current.id, true);
		persistManualChange(ctx);
		const next = store.current();
		ctx.ui.notify(
			next
				? `Done #${current.id}: ${current.text}; next: #${next.id} ${next.text}`
				: `Done #${current.id}: ${current.text}; all done`,
			"info",
		);
	}

	function returnToPrevious(ctx: ExtensionContext): void {
		const todos = store.getAll();
		if (todos.length === 0) {
			ctx.ui.notify("No todos.", "info");
			return;
		}

		const current = store.current();
		const currentIndex = current ? todos.findIndex((todo) => todo.id === current.id) : todos.length;
		const previous = todos[currentIndex - 1];
		if (!previous) {
			ctx.ui.notify("Already at the first item.", "info");
			return;
		}

		store.focus(previous.id);
		persistManualChange(ctx);
	}

	function installEditorShortcuts(ctx: ExtensionContext): void {
		const previousFactory = ctx.ui.getEditorComponent();
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = previousFactory?.(tui, theme, keybindings) ?? new CustomEditor(tui, theme, keybindings);
			const handleInput = editor.handleInput.bind(editor);
			editor.handleInput = (data: string) => {
				if (matchesKey(data, "ctrl+n")) {
					completeCurrent(ctx);
					return;
				}
				if (matchesKey(data, "ctrl+r")) {
					returnToPrevious(ctx);
					return;
				}
				handleInput(data);
			};
			return editor;
		});
	}

	registerTodoTool(pi, store, refreshWidget);

	pi.on("context", (event) => {
		const content = formatTodoContext(store.getAll());
		if (!content) return;
		return {
			messages: [
				...event.messages,
				{
					role: "custom" as const,
					customType: "todo-context",
					content,
					display: false,
					timestamp: Date.now(),
				},
			],
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		store.restore(ctx.sessionManager.getBranch());
		refreshWidget(ctx, false);
		if (ctx.mode === "tui") installEditorShortcuts(ctx);
	});

	pi.on("session_tree", async (_event, ctx) => {
		store.restore(ctx.sessionManager.getBranch());
		refreshWidget(ctx, false);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		clearTodoWidget(ctx);
	});

	async function showPanel(ctx: ExtensionContext): Promise<void> {
		if (ctx.mode !== "tui") {
			ctx.ui.notify(textList(store.getAll()), "info");
			return;
		}

		let selectedId: number | undefined;
		while (true) {
			const action = await ctx.ui.custom<TodoPanelAction>((tui, theme, keybindings, done) => {
				const panel = new TodoPanel(store.getAll(), theme, keybindings, done, selectedId);
				return {
					render: (width: number) => panel.render(width),
					invalidate: () => panel.invalidate(),
					handleInput: (data: string) => {
						panel.handleInput(data);
						tui.requestRender();
					},
				};
			});
			if (!action || action.type === "close") break;

			selectedId = action.id;
			if (action.type === "focus") {
				store.focus(action.id);
			} else {
				const todo = store.getAll().find((item) => item.id === action.id);
				if (todo) store.setDone(todo.id, !todo.done);
			}
			persistManualChange(ctx);
		}
	}


	pi.registerCommand("todo", {
		description: "View or edit this branch's todo list",
		getArgumentCompletions: (prefix) => {
			const values = ["add ", "done ", "rm ", "list", "clear-done", "reset"];
			const matches = values.filter((value) => value.startsWith(prefix)).map((value) => ({ value, label: value.trim() }));
			return matches.length > 0 ? matches : null;
		},
		handler: async (args, ctx) => {
			const input = args.trim();

			if (!input) {
				await showPanel(ctx);
				return;
			}

			if (input === "list") {
				ctx.ui.notify(textList(store.getAll()), "info");
				return;
			}

			if (input === "add" || input.startsWith("add ")) {
				const supplied = input.slice(3).trim();
				const text = supplied || (ctx.hasUI ? await ctx.ui.input("Add todo", "What needs to be done?") : undefined);
				if (!text?.trim()) {
					ctx.ui.notify("Todo text must not be empty. Example: /todo add verify the fix", "error");
					return;
				}
				const todo = store.add(text);
				persistManualChange(ctx);
				ctx.ui.notify(`Added #${todo.id}: ${todo.text}`, "info");
				return;
			}

			const doneMatch = input.match(/^done\s+#?(\d+)$/);
			if (doneMatch) {
				const id = Number(doneMatch[1]);
				const todo = store.getAll().find((item) => item.id === id);
				if (!todo) {
					ctx.ui.notify(`Todo #${id} not found.`, "error");
					return;
				}
				store.setDone(id, !todo.done);
				persistManualChange(ctx);
				ctx.ui.notify(`${todo.done ? "Reopened" : "Done"} #${id}: ${todo.text}`, "info");
				return;
			}

			const rmMatch = input.match(/^rm\s+#?(\d+)$/);
			if (rmMatch) {
				const id = Number(rmMatch[1]);
				const todo = store.getAll().find((item) => item.id === id);
				if (!todo) {
					ctx.ui.notify(`Todo #${id} not found.`, "error");
					return;
				}
				store.remove(id);
				persistManualChange(ctx);
				ctx.ui.notify(`Removed #${id}: ${todo.text}`, "info");
				return;
			}

			if (input === "clear-done") {
				const count = store.clearDone();
				if (count > 0) persistManualChange(ctx);
				ctx.ui.notify(count > 0 ? `Cleared ${count} done todo${count === 1 ? "" : "s"}` : "No done todos to clear", "info");
				return;
			}

			if (input === "reset") {
				const count = store.getAll().length;
				if (count === 0) {
					ctx.ui.notify("Todo list is already empty.", "info");
					return;
				}
				const confirmed = ctx.hasUI && (await ctx.ui.confirm("Reset todo list?", `Delete all ${count} todos?`));
				if (confirmed) {
					store.reset();
					persistManualChange(ctx);
					ctx.ui.notify("Todo list reset.", "info");
				}
				return;
			}

			ctx.ui.notify("Usage: /todo [add <text> | done <ID> | rm <ID> | list | clear-done | reset]", "error");
		},
	});
}