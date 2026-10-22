import { h } from './dom.js';
import { FallbackModal } from './fallback.js';
import { SettingsPanel } from './panel.js';
import { modalComponent } from './primitives.js';

export function SettingsDialog({ service, open, onClose }) {
  const Modal = modalComponent() ?? FallbackModal;
  return h(Modal, {
    open,
    onClose,
    title: '上下文窗口设置',
    closeLabel: '关闭',
    className: 'cp-dialog',
    description: '改动即时生效，无需重启；跟随上游表示不写死数值。',
  }, open ? h(SettingsPanel, { service }) : null);
}
