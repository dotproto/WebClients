import type {
    ItemCreateIntent,
    ItemEditIntent,
    ItemRevision,
    ItemType,
    MaybeNull,
    VaultShare,
} from '@proton/pass/types';
import type { ParsedUrl } from '@proton/pass/utils/url/parser';

export type ItemViewProps<T extends ItemType = ItemType> = {
    failed: boolean;
    optimistic: boolean;
    revision: ItemRevision<T>;
    trashed: boolean;
    vault: VaultShare;
    handleDeleteClick: () => void;
    handleDismissClick: () => void;
    handleEditClick: () => void;
    handleMoveToTrashClick: () => void;
    handleMoveToVaultClick: () => void;
    handleRestoreClick: () => void;
    handleRetryClick: () => void;
};

export type ItemEditViewProps<T extends ItemType = ItemType> = {
    revision: ItemRevision<T>;
    url: MaybeNull<ParsedUrl>;
    vault: VaultShare;
    onCancel: () => void;
    onSubmit: (item: ItemEditIntent<T>) => void;
};

export type ItemNewViewProps<T extends ItemType = ItemType> = {
    shareId: string;
    url: MaybeNull<ParsedUrl>;
    onCancel: () => void;
    onSubmit: (item: ItemCreateIntent<T>) => void;
};
