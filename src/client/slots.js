import { ComposerChip } from './chip.js';
import { h } from './dom.js';
import { SettingsPanel } from './panel.js';

export function registerSlots(ctx, service) {
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'context-presets-chip',
    order: 5,
    inject: (sessionId) => {
      const directories = ctx.modelDirectories ?? ctx.get?.('modelDirectories');
      const directory = directories.directoryFor(sessionId);
      return {
        directory: directory.store,
        load: () => directory.load(),
        service,
      };
    },
  }, ComposerChip));

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: 'dsh-context-presets',
    inject: () => ({ service }),
  }, (props = {}) => (props.view === 'summary' ? null : h(SettingsPanel, { service }))));
}
