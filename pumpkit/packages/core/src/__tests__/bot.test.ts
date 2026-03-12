import { describe, it, expect, vi } from 'vitest';
import { createBot, broadcast, setupShutdown } from '../bot/index.js';

describe('bot', () => {
  // Use a fake token — Grammy validates format but doesn't connect during construction
  const FAKE_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

  describe('createBot', () => {
    it('returns a Bot instance', () => {
      const bot = createBot({ token: FAKE_TOKEN });
      expect(bot).toBeDefined();
      expect(typeof bot.command).toBe('function');
      expect(typeof bot.start).toBe('function');
    });

    it('registers commands from options', () => {
      const commandSpy = vi.fn();
      const bot = createBot({
        token: FAKE_TOKEN,
        commands: {
          start: commandSpy,
          help: commandSpy,
        },
      });
      // Bot should have been configured without throwing
      expect(bot).toBeDefined();
    });

    it('uses custom error handler', () => {
      const errorHandler = vi.fn();
      const bot = createBot({
        token: FAKE_TOKEN,
        onError: errorHandler,
      });
      expect(bot).toBeDefined();
    });
  });

  describe('broadcast', () => {
    it('sends messages to all chat IDs', async () => {
      const bot = createBot({ token: FAKE_TOKEN });
      const sendSpy = vi.fn().mockResolvedValue({});
      bot.api.sendMessage = sendSpy;

      const result = await broadcast(bot, [111, 222], 'hello');
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenCalledWith(111, 'hello', { parse_mode: 'HTML' });
      expect(sendSpy).toHaveBeenCalledWith(222, 'hello', { parse_mode: 'HTML' });
    });

    it('counts failures when sendMessage throws', async () => {
      const bot = createBot({ token: FAKE_TOKEN });
      bot.api.sendMessage = vi.fn().mockRejectedValue(new Error('blocked'));

      const result = await broadcast(bot, [111, 222], 'hello');
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(2);
    });

    it('uses custom parseMode', async () => {
      const bot = createBot({ token: FAKE_TOKEN });
      const sendSpy = vi.fn().mockResolvedValue({});
      bot.api.sendMessage = sendSpy;

      await broadcast(bot, [111], 'hello', { parseMode: 'MarkdownV2' });
      expect(sendSpy).toHaveBeenCalledWith(111, 'hello', { parse_mode: 'MarkdownV2' });
    });

    it('returns zeros for empty chatIds array', async () => {
      const bot = createBot({ token: FAKE_TOKEN });
      const result = await broadcast(bot, [], 'hello');
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('setupShutdown', () => {
    it('registers signal handlers without throwing', () => {
      const bot = createBot({ token: FAKE_TOKEN });
      expect(() => setupShutdown(bot)).not.toThrow();
    });

    it('accepts cleanup functions', () => {
      const bot = createBot({ token: FAKE_TOKEN });
      const cleanup = vi.fn();
      expect(() => setupShutdown(bot, cleanup)).not.toThrow();
    });
  });
});
