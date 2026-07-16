export interface Todo {
	id: number;
	text: string;
	done: boolean;
	note?: string;
}

export interface TodoSnapshot {
	version: 2;
	todos: Todo[];
	nextId: number;
}

function cloneTodo(todo: Todo): Todo {
	return { ...todo };
}

export function cloneTodos(todos: readonly Todo[]): Todo[] {
	return todos.map(cloneTodo);
}

function normalizeTodo(raw: unknown, seenIds: Set<number>): Todo | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const todo = raw as { id?: unknown; text?: unknown; note?: unknown; done?: unknown; status?: unknown };
	if (!Number.isInteger(todo.id) || (todo.id as number) < 1 || seenIds.has(todo.id as number)) return undefined;
	if (typeof todo.text !== "string" || !todo.text.trim()) return undefined;
	if (todo.note !== undefined && typeof todo.note !== "string") return undefined;

	let done: boolean;
	if (typeof todo.done === "boolean") done = todo.done;
	else if (typeof todo.status === "string") done = todo.status === "done";
	else return undefined;

	seenIds.add(todo.id as number);
	const note = typeof todo.note === "string" ? todo.note.trim() : "";
	return { id: todo.id as number, text: (todo.text as string).trim(), done, ...(note ? { note } : {}) };
}

function parseSnapshot(value: unknown): TodoSnapshot | undefined {
	if (!value || typeof value !== "object") return undefined;
	const candidate = value as { version?: unknown; todos?: unknown; nextId?: unknown };
	if ((candidate.version !== 1 && candidate.version !== 2) || !Array.isArray(candidate.todos)) return undefined;

	const todos: Todo[] = [];
	const seenIds = new Set<number>();
	for (const raw of candidate.todos) {
		const todo = normalizeTodo(raw, seenIds);
		if (!todo) return undefined;
		todos.push(todo);
	}

	const highestId = todos.reduce((max, todo) => Math.max(max, todo.id), 0);
	const nextId =
		Number.isInteger(candidate.nextId) && (candidate.nextId as number) > highestId
			? (candidate.nextId as number)
			: highestId + 1;
	return { version: 2, todos, nextId };
}

function snapshotFromEntry(entry: unknown): TodoSnapshot | undefined {
	if (!entry || typeof entry !== "object") return undefined;
	const item = entry as {
		type?: string;
		customType?: string;
		data?: unknown;
		message?: { role?: string; toolName?: string; details?: unknown };
	};

	if (item.type === "custom" && item.customType === "todo-state") {
		return parseSnapshot(item.data);
	}
	if (item.type === "message" && item.message?.role === "toolResult" && item.message.toolName === "todo") {
		const details = item.message.details as { snapshot?: unknown } | undefined;
		return parseSnapshot(details?.snapshot);
	}
	return undefined;
}

export class TodoStore {
	private todos: Todo[] = [];
	private nextId = 1;

	getAll(): Todo[] {
		return cloneTodos(this.todos);
	}

	getSnapshot(): TodoSnapshot {
		return { version: 2, todos: this.getAll(), nextId: this.nextId };
	}

	/** The current item is derived: the first unfinished todo. */
	current(): Todo | undefined {
		const todo = this.todos.find((item) => !item.done);
		return todo ? cloneTodo(todo) : undefined;
	}

	restore(entries: readonly unknown[]): void {
		let latest: TodoSnapshot | undefined;
		for (const entry of entries) {
			const snapshot = snapshotFromEntry(entry);
			if (snapshot) latest = snapshot;
		}
		this.todos = latest ? cloneTodos(latest.todos) : [];
		this.nextId = latest?.nextId ?? 1;
	}

	add(text: string, note?: string, done = false): Todo {
		const normalized = text.trim();
		if (!normalized) throw new Error("Todo text must not be empty.");
		const trimmedNote = note?.trim();
		const todo: Todo = { id: this.nextId++, text: normalized, done, ...(trimmedNote ? { note: trimmedNote } : {}) };
		this.todos.push(todo);
		return cloneTodo(todo);
	}

	update(id: number, text?: string, note?: string): Todo {
		const todo = this.require(id);
		if (text !== undefined) {
			const normalized = text.trim();
			if (!normalized) throw new Error("Todo text must not be empty.");
			todo.text = normalized;
		}
		if (note !== undefined) {
			const normalized = note.trim();
			if (normalized) todo.note = normalized;
			else delete todo.note;
		}
		return cloneTodo(todo);
	}

	setDone(id: number, done: boolean, note?: string): Todo {
		const todo = this.require(id);
		todo.done = done;
		if (note !== undefined) {
			const normalized = note.trim();
			if (normalized) todo.note = normalized;
			else delete todo.note;
		}
		return cloneTodo(todo);
	}

	/** Reopen and move a todo before the current (first unfinished) item. */
	focus(id: number): Todo {
		const index = this.todos.findIndex((todo) => todo.id === id);
		if (index < 0) throw new Error(`Todo #${id} not found.`);
		const [todo] = this.todos.splice(index, 1);
		todo!.done = false;
		const currentIndex = this.todos.findIndex((item) => !item.done);
		this.todos.splice(currentIndex < 0 ? this.todos.length : currentIndex, 0, todo!);
		return cloneTodo(todo!);
	}

	remove(id: number): Todo {
		const index = this.todos.findIndex((todo) => todo.id === id);
		if (index < 0) throw new Error(`Todo #${id} not found.`);
		const [todo] = this.todos.splice(index, 1);
		return cloneTodo(todo!);
	}

	moveBefore(id: number, beforeId?: number): void {
		const index = this.todos.findIndex((todo) => todo.id === id);
		if (index < 0) throw new Error(`Todo #${id} not found.`);
		const [todo] = this.todos.splice(index, 1);
		if (beforeId === undefined) {
			this.todos.push(todo!);
			return;
		}
		const target = this.todos.findIndex((item) => item.id === beforeId);
		if (target < 0) throw new Error(`Todo #${beforeId} not found.`);
		this.todos.splice(target, 0, todo!);
	}

	clearDone(): number {
		const before = this.todos.length;
		this.todos = this.todos.filter((todo) => !todo.done);
		return before - this.todos.length;
	}

	reset(): number {
		const count = this.todos.length;
		this.todos = [];
		this.nextId = 1;
		return count;
	}

	replace(items: Array<{ text: string; done?: boolean; note?: string }>): void {
		this.todos = [];
		this.nextId = 1;
		for (const item of items) {
			this.add(item.text, item.note, item.done ?? false);
		}
	}

	private require(id: number): Todo {
		const todo = this.todos.find((item) => item.id === id);
		if (!todo) throw new Error(`Todo #${id} not found.`);
		return todo;
	}
}