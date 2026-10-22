import { installStyles } from './dom.js';
import { createService } from './service.js';
import { registerSlots } from './slots.js';
import { CSS } from './styles.js';

export const name = 'context-presets';
export const inject = ['slots', 'modelDirectories', 'remote', 'remote.llm', 'remote.settings'];

const STYLE_ID = 'dsh-context-presets-style';

export function apply(ctx) {
  ctx.effect(() => installStyles(STYLE_ID, CSS));
  const service = createService(ctx);
  if (!service.available) return;
  registerSlots(ctx, service);
}
