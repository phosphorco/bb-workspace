
it("root witness: producer body through actual HTTP has no outer native frame", async () => {
  const f = await fixture();
  f.unconfigure();
  try {
    const thread = f.newThread();
    const producerInput: PromptInput[] = [{ type: "text", text: "[sender=cole]\nOriginal annotation\n[/sender=cole]", mentions: [] }];
    const response = await f.post(`/threads/${thread.id}/send`, { input: producerInput, mode: "start", ...execution });
    expect(response.status).toBe(200);
    const { command } = await waitForQueuedCommand(f.harness, ({ command }) => command.type === "turn.submit" && command.threadId === thread.id);
    if (command.type !== "turn.submit") throw new Error("Expected submit");
    expect(command.input).toEqual(producerInput);
  } finally { await f.harness.cleanup(); }
});
