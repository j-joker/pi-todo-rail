import { mkdirSync, writeFileSync } from "node:fs";

const directory = "/tmp/pi-todo-branch-demo";
const output = `${directory}/session.jsonl`;
mkdirSync(directory, { recursive: true });

const timestamp = (second) => `2026-07-17T12:00:${String(second).padStart(2, "0")}.000Z`;
const user = (id, parentId, content, second) => ({
	type: "message",
	id,
	parentId,
	timestamp: timestamp(second),
	message: { role: "user", content, timestamp: Date.parse(timestamp(second)) },
});
const assistant = (id, parentId, text, second) => ({
	type: "message",
	id,
	parentId,
	timestamp: timestamp(second),
	message: {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai-codex",
		model: "gpt-5.6-sol",
		stopReason: "stop",
		timestamp: Date.parse(timestamp(second)),
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
	},
});
const todo = (id, parentId, todos, nextId, second) => ({
	type: "custom",
	id,
	parentId,
	timestamp: timestamp(second),
	customType: "todo-state",
	data: { version: 2, todos, nextId },
});

const entries = [
	{
		type: "session",
		version: 3,
		id: "11111111-2222-4333-8444-555555555555",
		timestamp: timestamp(0),
		cwd: directory,
	},
	user("a0000001", null, "Harden the password reset flow.", 1),
	todo(
		"a0000002",
		"a0000001",
		[
			{ id: 1, text: "Audit reset flow", done: true },
			{ id: 2, text: "Choose implementation scope", done: false },
		],
		3,
		2,
	),
	user("b0000001", "a0000002", "Take the full hardening path.", 3),
	todo(
		"b0000002",
		"b0000001",
		[
			{ id: 1, text: "Remove token logging", done: true },
			{ id: 2, text: "Validate redirect URLs", done: false },
			{ id: 3, text: "Expire reset tokens", done: false },
		],
		4,
		4,
	),
	assistant("b0000003", "b0000002", "Full hardening plan is ready.", 5),
	user("c0000001", "a0000002", "Take the minimal patch path.", 6),
	todo(
		"c0000002",
		"c0000001",
		[
			{ id: 1, text: "Patch redirect validator", done: false },
			{ id: 2, text: "Add regression test", done: false },
		],
		3,
		7,
	),
	assistant("c0000003", "c0000002", "Minimal patch plan is ready.", 8),
];

writeFileSync(output, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
