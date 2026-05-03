export class AIProvider {
  async generateResponse(_prompt, _context) {
    throw new Error('AI providers must implement generateResponse(prompt, context).');
  }
}

export class DisabledAIProvider extends AIProvider {
  async generateResponse() {
    return {
      content: 'AI is not configured yet. AB Bot can still import, review, and summarize structured budget data locally.',
      usage: null,
    };
  }
}
