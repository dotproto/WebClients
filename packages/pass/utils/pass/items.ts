import { Item, ItemRevision } from '@proton/pass/types';

export const isLoginItem = (item: Item): item is Item<'login'> => item.type === 'login';
export const isAliasItem = (item: Item): item is Item<'alias'> => item.type === 'alias';
export const isNoteItem = (item: Item): item is Item<'note'> => item.type === 'note';

export const getItemKey = ({ shareId, itemId, revision }: ItemRevision) => `${shareId}-${itemId}-${revision}`;

export const getOptimisticItemActionId = (
    payload:
        | { optimisticId: string; itemId?: string; shareId: string }
        | { optimisticId?: string; itemId: string; shareId: string }
) => `${payload.shareId}-${payload?.optimisticId ?? payload.itemId!}`;