import type { ItemCreateIntent, ItemEditIntent, ItemRevision, ItemType, VaultShare } from '@proton/pass/types';

export type ItemTypeViewProps<T extends ItemType = ItemType> = {
    vault: VaultShare;
    revision: ItemRevision<T>;
    handleEditClick: () => void;
    handleRetryClick: () => void;
    handleDismissClick: () => void;
    handleMoveToTrashClick: () => void;
    handleRestoreClick: () => void;
    handleDeleteClick: () => void;
    optimistic: boolean;
    failed: boolean;
    trashed: boolean;
};

export type ItemEditProps<T extends ItemType = ItemType> = {
    vault: VaultShare;
    revision: ItemRevision<T>;
    onSubmit: (item: ItemEditIntent<T>) => void;
    onCancel: () => void;
};

export type ItemNewProps<T extends ItemType = ItemType> = {
    vaultId: string;
    onSubmit: (item: ItemCreateIntent<T>) => void;
    onCancel: () => void;
};