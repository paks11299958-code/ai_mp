import React from 'react';
import { EunbiEntryChatModal, type EntryChatModalProps as BaseEntryChatModalProps } from './EunbiEntryChatModal';
import { ChaewonEntryChatModal } from './ChaewonEntryChatModal';
import { StudyEntryChatModal } from './StudyEntryChatModal';
import { ChaerinEntryChatModal } from './ChaerinEntryChatModal';
import { SeolaEntryChatModal } from './SeolaEntryChatModal';
import { ArinEntryChatModal } from './ArinEntryChatModal';
import { DogyeolEntryChatModal } from './DogyeolEntryChatModal';
import { HajinEntryChatModal } from './HajinEntryChatModal';
export type { EntryChatSendResult } from './EunbiEntryChatModal';
export { renderVisualNovelText } from './EunbiEntryChatModal';

export interface EntryChatModalProps extends BaseEntryChatModalProps {
    onFeature?: (key: string) => void;
}

/** Visual presets share the existing onSend contract; Eunbi retains its exact renderer. */
export const EntryChatModal: React.FC<EntryChatModalProps & { draftOwner?: string }> = (props) =>
    props.theme.visualPreset === 'showroom' ? (
        <HajinEntryChatModal {...props} />
    ) : props.theme.visualPreset === 'study' ? (
        <StudyEntryChatModal {...props} />
    ) : props.theme.visualPreset === 'desk' ? (
        <ChaewonEntryChatModal {...props} />
    ) : props.theme.visualPreset === 'beauty' ? (
        <ChaerinEntryChatModal {...props} />
    ) : props.theme.visualPreset === 'golf' ? (
        <SeolaEntryChatModal {...props} />
    ) : props.theme.visualPreset === 'studio' ? (
        <ArinEntryChatModal {...props} />
    ) : props.theme.visualPreset === 'letter' ? (
        <DogyeolEntryChatModal {...props} />
    ) : (
        <EunbiEntryChatModal {...props} />
    );
