import type { Todo } from "./state.ts";

/** Transient model context. Appended at the tail so the stable prompt prefix stays cacheable. */
export function formatTodoContext(todos: readonly Todo[]): string | undefined {
	if (todos.length === 0) return undefined;
	const done = todos.filter((todo) => todo.done).length;
	const current = todos.find((todo) => !todo.done);
	if (!current) {
		return `[Runtime todo context — not a user request]\nAll ${todos.length} todos are complete.`;
	}
	const note = current.note ? ` — ${current.note}` : "";
	return `[Runtime todo context — not a user request]\nCurrent todo: #${current.id} ${current.text}${note} (${done}/${todos.length} done).`;
}
