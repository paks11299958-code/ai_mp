import React from 'react';
import { EunbiEntryChatModal, type EntryChatModalProps } from './EunbiEntryChatModal';
import { DogyeolEntryChatModal } from './DogyeolEntryChatModal';
export type { EntryChatSendResult } from './EunbiEntryChatModal';
export { renderVisualNovelText } from './EunbiEntryChatModal';

/** Visual presets share the existing onSend contract; Eunbi retains its exact renderer. */
export const EntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = props =>
    props.theme.visualPreset === 'letter'
        ? <DogyeolEntryChatModal {...props} />
        : <EunbiEntryChatModal {...props} />;
