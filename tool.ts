import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
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

function currentIdOf(todos: readonly Todo[]): number | undefined {
	return todos.find((todo) => !todo.done)?.id;
}

/** Model-facing plain-text list. Kept in English so tool behavior is locale-independent. */
function formatTodos(todos: readonly Todo[]): string {
	if (todos.length === 0) return "No todos.";
	const currentId = currentIdOf(todos);
	return todos
		.map((todo) => {
			const marker = todo.done ? "x" : todo.id === currentId ? "*" : " ";
			return `[${marker}] #${todo.id}: ${todo.text}${todo.note ? ` (${todo.note})` : ""}`;
		})
		.join("\n");
}

function styledLine(todo: Todo, currentId: number | undefined): string {
	if (todo.done) return `x  #${todo.id} ${todo.text}`;
	const marker = todo.id === currentId ? "*" : " ";
	const note = todo.note ? ` (${todo.note})` : "";
	return `${marker}  #${todo.id} ${todo.text}${note}`;
}

/** Collapsed view keeps the current item first; done history collapses into a count. */
export function styledList(todos: readonly Todo[], expanded: boolean): string {
	const currentId = currentIdOf(todos);
	if (expanded) return todos.map((todo) => styledLine(todo, currentId)).join("\n");

	const unfinished = todos.filter((todo) => !todo.done);
	const doneCount = todos.length - unfinished.length;
	if (unfinished.length === 0) return "All done";

	const limit = 4;
	const lines = unfinished.slice(0, limit).map((todo) => styledLine(todo, currentId));
	const parts: string[] = [];
	if (unfinished.length > limit) parts.push(`+${unfinished.length - limit} more`);
	if (doneCount > 0) parts.push(`x ${doneCount}`);
	if (parts.length > 0) lines.push(`   … ${parts.join(" · ")}`);
	return lines.join("\n");
}

export function registerTodoTool(pi: ExtensionAPI, store: TodoStore, onChange: (ctx: ExtensionContext) => void): void {
	pi.registerTool({
		name: "todo",
		label: "Todo",
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

		renderCall(args, _theme) {
			const id = args.id !== undefined ? ` #${args.id}` : "";
			let body: string;
			switch (args.action) {
				case "list": body = "view"; break;
				case "add": body = "add"; break;
				case "update": body = `edit${id}`; break;
				case "start": body = `set current${id}`; break;
				case "done": body = `done${id}`; break;
				case "block": body = `note${id}`; break;
				case "remove": body = `remove${id}`; break;
				case "reorder": body = `move${id} ${args.beforeId !== undefined ? `before #${args.beforeId}` : "to end"}`; break;
				case "clear_done": body = "clear done"; break;
				case "replace": body = `plan ${args.items?.length ?? 0}`; break;
				default: body = String(args.action);
			}
			return new Text(`Todo  ${body}`, 0, 0);
		},

		renderResult(result, { expanded }, _theme) {
			const details = result.details as TodoToolDetails | undefined;
			const fallback = () => {
				const content = result.content[0];
				return new Text(content?.type === "text" ? content.text : "", 0, 0);
			};
			if (!details?.snapshot) return fallback();

			const todos = details.snapshot.todos;
			const total = todos.length;
			const done = todos.filter((item) => item.done).length;
			const progress = `${done}/${total}`;
			const currentId = currentIdOf(todos);
			const receipt = (line: string) => {
				const summary = total > 0 ? `${line}  ${progress}` : line;
				if (!expanded || total === 0) return new Text(summary, 0, 0);
				return new Text(`${summary}\n\n${styledList(todos, true)}`, 0, 0);
			};

			// Order-centric actions render as the list itself.
			if (details.action === "list" || details.action === "reorder" || details.action === "replace") {
				if (total === 0) return new Text("No todos", 0, 0);
				return new Text(`${progress}\n${styledList(todos, expanded)}`, 0, 0);
			}

			if (details.action === "clear_done") {
				return receipt(details.count ? `cleared ${details.count}` : "nothing to clear");
			}

			// Object-centric actions render the affected item's state.
			const todo = details.todo;
			if (!todo) return fallback();
			const note = todo.note ? ` (${todo.note})` : "";
			const marker = todo.done ? "x" : todo.id === currentId ? "*" : " ";

			switch (details.action) {
				case "add":
					return receipt(`+  #${todo.id}  ${todo.text}${note}`);
				case "done":
					return receipt(`x  #${todo.id}  ${todo.text}${note}`);
				case "remove":
					return receipt(`-  #${todo.id}  ${todo.text}`);
				default:
					return receipt(`${marker}  #${todo.id}  ${todo.text}${note}`);
			}
			},
	});
}
