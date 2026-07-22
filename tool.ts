import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { currentTodoId, todoProgress, todoTitle, todoTree } from "./render.ts";
import type { Todo, TodoSnapshot, TodoStore } from "./state.ts";

// The agent marks work done after implementation and verification. Reopening
// remains a user action in the panel or /todo command.
const TodoParams = Type.Object({
	action: StringEnum(["list", "add", "update", "start", "done", "block", "remove", "reorder", "clear_done", "replace"] as const),
	id: Type.Optional(Type.Number({ description: "Todo ID" })),
	text: Type.Optional(Type.String({ description: "Todo text" })),
	note: Type.Optional(Type.String({ description: "Context or blocking reason" })),
	beforeId: Type.Optional(Type.Number({ description: "For reorder: move id before this todo; omit to move to end" })),
	items: Type.Optional(
		Type.Array(
			Type.Object({
				text: Type.String(),
				note: Type.Optional(Type.String()),
			}),
			{ description: "Replacement execution plan" },
		),
	),
});

/**
 * `content` is model-facing; the compact UI renders from structured details
 * instead of parsing prose from the tool result.
 */
interface TodoToolDetails {
	action: string;
	todo?: Todo;
	count?: number;
	snapshot: TodoSnapshot;
}

function requireId(id: number | undefined): number {
	if (id === undefined || !Number.isInteger(id) || id < 1) throw new Error("A valid todo ID is required.");
	return id;
}

/** Model-facing plain-text list. Kept in English so tool behavior is locale-independent. */
function formatTodos(todos: readonly Todo[]): string {
	if (todos.length === 0) return "No todos.";
	const currentId = currentTodoId(todos);
	return todos
		.map((todo) => {
			const marker = todo.done ? "x" : todo.id === currentId ? "*" : " ";
			return `[${marker}] #${todo.id}: ${todo.text}${todo.note ? ` (${todo.note})` : ""}`;
		})
		.join("\n");
}

export function registerTodoTool(pi: ExtensionAPI, store: TodoStore, onChange: (ctx: ExtensionContext) => void): void {
	pi.registerTool({
		name: "todo",
		label: "Todo",
		renderShell: "self",
		description:
			"Manage the current session branch's todo list. Mark an item done immediately after its work is implemented and verified. The current item is always the first unfinished one. Use reorder or start to change what is current, and note to record context or blockers. Reopening remains user-controlled.",
		promptSnippet: "Manage the branch-aware todo list and mark verified work done",
		promptGuidelines: [
			"Use todo for multi-step coding work; do not create todos for simple questions or one-step changes.",
			"After implementing and verifying a todo, immediately call todo with action done for its ID before moving on; do not wait for user confirmation.",
			"Only mark a todo done after verification. If blocked, record the reason with todo block, then continue or reorder.",
			"Treat user-edited todo items as authoritative; do not replace the list unless the user asks for a new plan.",
		],
		parameters: TodoParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) throw new Error("Todo update cancelled.");
			let message: string;
			let mutated = true;
			let todo: Todo | undefined;
			let count: number | undefined;

			switch (params.action) {
				case "list":
					mutated = false;
					message = formatTodos(store.getAll());
					break;
				case "add": {
					todo = store.add(params.text ?? "", params.note);
					message = `Added #${todo.id}: ${todo.text}`;
					break;
				}
				case "update": {
					if (params.text === undefined && params.note === undefined)
						throw new Error("Provide text or a note to update.");
					todo = store.update(requireId(params.id), params.text, params.note);
					message = `Updated #${todo.id}: ${todo.text}`;
					break;
				}
				case "start": {
					const id = requireId(params.id);
					const selected = store.getAll().find((item) => item.id === id);
					if (selected?.done)
						throw new Error(`Todo #${id} is already done; only the user can reopen it from the todo panel.`);
					todo = store.focus(id);
					if (params.note !== undefined) todo = store.update(todo.id, undefined, params.note);
					message = `Current: #${todo.id} ${todo.text}`;
					break;
				}
				case "done": {
					const id = requireId(params.id);
					const selected = store.getAll().find((item) => item.id === id);
					if (!selected) throw new Error(`Todo #${id} not found.`);
					if (selected.done) {
						mutated = false;
						todo = selected;
						message = `Todo #${id} is already done.`;
						break;
					}
					todo = store.setDone(id, true, params.note);
					message = `Completed #${todo.id}: ${todo.text}`;
					break;
				}
				case "block": {
					if (!params.note?.trim()) throw new Error("Provide a note or blocking reason.");
					todo = store.update(requireId(params.id), undefined, params.note);
					message = `Noted #${todo.id}: ${params.note.trim()}`;
					break;
				}
				case "remove": {
					todo = store.remove(requireId(params.id));
					message = `Removed #${todo.id}: ${todo.text}`;
					break;
				}
				case "reorder": {
					const id = requireId(params.id);
					store.moveBefore(id, params.beforeId);
					message = params.beforeId === undefined ? `Moved #${id} to the end.` : `Moved #${id} before #${params.beforeId}.`;
					break;
				}
				case "clear_done": {
					count = store.clearDone();
					message = count === 0 ? "No done todos to clear." : `Cleared ${count} done todos.`;
					break;
				}
				case "replace": {
					if (!params.items) throw new Error("Provide the new plan items.");
					store.replace(params.items.map((item) => ({ text: item.text, note: item.note })));
					count = params.items.length;
					message = `New plan (${count} steps):\n${formatTodos(store.getAll())}`;
					break;
				}
				default:
					throw new Error(`Unsupported todo action: ${String(params.action)}`);
			}

			if (mutated) onChange(ctx);
			return {
				content: [{ type: "text", text: message }],
				details: {
					action: params.action,
					...(todo ? { todo } : {}),
					...(count !== undefined ? { count } : {}),
					snapshot: store.getSnapshot(),
				} satisfies TodoToolDetails,
			};
		},

		renderCall(args, theme) {
			const id = args.id !== undefined ? ` #${args.id}` : "";
			let body: string;
			switch (args.action) {
				case "list": body = "view plan"; break;
				case "add": body = args.text ? `add ${args.text}` : "add item"; break;
				case "update": body = `edit${id}`; break;
				case "start": body = `set current${id}`; break;
				case "done": body = `complete${id}`; break;
				case "block": body = `note${id}`; break;
				case "remove": body = `remove${id}`; break;
				case "reorder": body = `move${id} ${args.beforeId !== undefined ? `before #${args.beforeId}` : "to end"}`; break;
				case "clear_done": body = "clear completed"; break;
				case "replace": body = `replace plan · ${args.items?.length ?? 0} items`; break;
				default: body = String(args.action);
			}
			return new Text(`${theme.fg("muted", "○")} ${theme.fg("muted", body)}`, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as TodoToolDetails | undefined;
			const fallback = () => {
				const content = result.content[0];
				return new Text(theme.fg("muted", content?.type === "text" ? content.text : ""), 0, 0);
			};
			if (!details?.snapshot) return fallback();

			const todos = details.snapshot.todos;
			const progress = todoProgress(todos);
			const progressSuffix = progress.total > 0 ? `  ${theme.fg("dim", progress.label)}` : "";
			const receipt = (glyph: string, tone: "success" | "accent" | "warning" | "muted", line: string) => {
				const summary = `${theme.fg(tone, glyph)} ${line}${progressSuffix}`;
				if (!expanded || progress.total === 0) return new Text(summary, 0, 0);
				return new Text(`${summary}\n${todoTree(todos, theme, true)}`, 0, 0);
			};

			if (details.action === "list" || details.action === "reorder" || details.action === "replace") {
				const state = progress.total > 0 && progress.done === progress.total ? "done" : "active";
				const title = todoTitle(theme, progress.label, state);
				return new Text(`${title}\n${todoTree(todos, theme, expanded)}`, 0, 0);
			}

			if (details.action === "clear_done") {
				return details.count
					? receipt("✓", "success", `${theme.fg("text", `Cleared ${details.count} completed`)}`)
					: receipt("○", "muted", theme.fg("muted", "Nothing to clear"));
			}

			const todo = details.todo;
			if (!todo) return fallback();
			const item = `${theme.fg("dim", `#${todo.id}`)} ${theme.fg("text", todo.text)}${todo.note ? theme.fg("dim", `  ${todo.note}`) : ""}`;

			switch (details.action) {
				case "add":
					return receipt("+", "accent", `${theme.fg("text", "Added")}  ${item}`);
				case "done":
					return receipt("✓", "success", `${theme.fg("text", "Completed")}  ${item}`);
				case "remove":
					return receipt("−", "warning", `${theme.fg("text", "Removed")}  ${theme.fg("dim", `#${todo.id}`)} ${theme.fg("muted", todo.text)}`);
				case "block":
					return receipt("!", "warning", `${theme.fg("text", "Noted")}  ${item}`);
				case "start":
					return receipt("●", "accent", `${theme.fg("text", "Current")}  ${item}`);
				case "update":
					return receipt("✓", "success", `${theme.fg("text", "Updated")}  ${item}`);
				default:
					return receipt("✓", "success", item);
			}
			},
	});
}
