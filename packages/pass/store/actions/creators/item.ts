import { createAction } from '@reduxjs/toolkit';
import { c } from 'ttag';

import { ItemCreateIntent, ItemEditIntent, ItemRevision } from '@proton/pass/types';
import { pipe } from '@proton/pass/utils/fp';
import { getOptimisticItemActionId } from '@proton/pass/utils/pass/items';

import { createOptimisticAction } from '../../optimistic/action/create-optimistic-action';
import * as requests from '../requests';
import withCacheBlock from '../with-cache-block';
import withCallback, { ActionCallback } from '../with-callback';
import withNotification from '../with-notification';
import withRequest from '../with-request';

export const itemCreationIntent = createOptimisticAction(
    'item creation intent',
    (
        payload: ItemCreateIntent,
        callback?: ActionCallback<ReturnType<typeof itemCreationSuccess> | ReturnType<typeof itemCreationFailure>>
    ) => pipe(withCacheBlock, withCallback(callback))({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemCreationFailure = createOptimisticAction(
    'item creation failure',
    (payload: { optimisticId: string; shareId: string }, error: unknown) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.optimisticId,
                type: 'error',
                text: c('Error').t`Item creation failed`,
                error,
            })
        )({ payload, error }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemCreationDismiss = createOptimisticAction(
    'item creation dismiss',
    (payload: { optimisticId: string; shareId: string; item: ItemRevision }) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.optimisticId,
                type: 'info',
                text: c('Info').t`"${payload.item.data.metadata.name}" item was dismissed`,
            })
        )({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemCreationSuccess = createOptimisticAction(
    'item creation success',
    (payload: { optimisticId: string; shareId: string; item: ItemRevision }) =>
        withNotification({
            type: 'success',
            text: c(`Info`).t`Item saved to vault`,
        })({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemEditIntent = createOptimisticAction(
    'item edit intent',
    (
        payload: ItemEditIntent,
        callback?: ActionCallback<ReturnType<typeof itemEditSuccess> | ReturnType<typeof itemEditFailure>>
    ) => pipe(withCacheBlock, withCallback(callback))({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemEditFailure = createOptimisticAction(
    'item edit failure',
    (payload: { itemId: string; shareId: string }, error: unknown) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.itemId,
                type: 'error',
                text: c('Error').t`Editing item failed`,
                error,
            })
        )({ payload, error }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemEditDismiss = createOptimisticAction(
    'item edit dismiss',
    (payload: { itemId: string; shareId: string; item: ItemRevision }) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.itemId,
                type: 'info',
                text: c('Info').t`"${payload.item.data.metadata.name}" update was dismissed`,
            })
        )({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemEditSuccess = createOptimisticAction(
    'item edit success',
    (payload: { item: ItemRevision; itemId: string; shareId: string }) =>
        withNotification({
            type: 'success',
            text: c('Info').t`Item successfully updated`,
        })({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemEditSync = createAction(
    'item edit sync',
    (payload: { item: ItemRevision; itemId: string; shareId: string }) => ({ payload })
);

export const itemTrashIntent = createOptimisticAction(
    'item trash intent',
    (
        payload: { item: ItemRevision; shareId: string; itemId: string },
        callback?: ActionCallback<ReturnType<typeof itemTrashSuccess> | ReturnType<typeof itemTrashFailure>>
    ) => pipe(withCacheBlock, withCallback(callback))({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemTrashFailure = createOptimisticAction(
    'item trash failure',
    (payload: { itemId: string; shareId: string }, error: unknown) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.itemId,
                type: 'error',
                text: c('Error').t`Trashing item failed`,
                error,
            })
        )({ payload, error }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemTrashSuccess = createOptimisticAction(
    'item trash success',
    (payload: { itemId: string; shareId: string }) =>
        withNotification({
            type: 'success',
            text: c('Info').t`Item moved to trash`,
        })({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemDeleteIntent = createOptimisticAction(
    'item delete intent',
    (
        payload: { item: ItemRevision; itemId: string; shareId: string },
        callback?: ActionCallback<ReturnType<typeof itemDeleteSuccess> | ReturnType<typeof itemDeleteFailure>>
    ) => pipe(withCacheBlock, withCallback(callback))({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemDeleteFailure = createOptimisticAction(
    'item delete failure',
    (payload: { itemId: string; shareId: string }, error: unknown) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.itemId,
                type: 'error',
                text: c('Error').t`Deleting item failed`,
                error,
            })
        )({ payload, error }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemDeleteSuccess = createOptimisticAction(
    'item delete success',
    (payload: { itemId: string; shareId: string }) =>
        withNotification({
            type: 'success',
            text: c('Info').t`Item permanently deleted`,
        })({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemDeleteSync = createAction('item delete sync', (payload: { itemId: string; shareId: string }) => ({
    payload,
}));

export const itemRestoreIntent = createOptimisticAction(
    'restore item intent',
    (
        payload: { item: ItemRevision; itemId: string; shareId: string },
        callback?: ActionCallback<ReturnType<typeof itemRestoreSuccess> | ReturnType<typeof itemRestoreFailure>>
    ) => pipe(withCacheBlock, withCallback(callback))({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemRestoreFailure = createOptimisticAction(
    'restore item failure',
    (payload: { itemId: string; shareId: string }, error: unknown) =>
        pipe(
            withCacheBlock,
            withNotification({
                id: payload.itemId,
                type: 'error',
                text: c('Error').t`Restoring item failed`,
                error,
            })
        )({ payload, error }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemRestoreSuccess = createOptimisticAction(
    'restore item success',
    (payload: { itemId: string; shareId: string }) =>
        withNotification({
            type: 'success',
            text: c('Info').t`Item restored`,
        })({ payload }),
    ({ payload }) => getOptimisticItemActionId(payload)
);

export const itemUsed = createAction('item used', (payload: { shareId: string; itemId: string }) => ({ payload }));
export const itemLastUseTimeUpdated = createAction(
    'item lastUseTime updated',
    (payload: { shareId: string; itemId: string; lastUseTime: number }) => ({ payload })
);

export const itemsRequested = createAction('items requested', (shareId: string) =>
    pipe(
        withCacheBlock,
        withRequest({
            id: requests.items(),
            type: 'start',
        })
    )({ payload: { shareId } })
);

export const itemsRequestSuccess = createAction(
    'items request success',
    (payload: { shareId: string; items: ItemRevision[] }) =>
        withRequest({
            id: requests.items(),
            type: 'success',
        })({ payload })
);

export const itemsRequestFailure = createAction('items request failure', (error: unknown) =>
    pipe(
        withCacheBlock,
        withRequest({
            id: requests.items(),
            type: 'failure',
        })
    )({ payload: {}, error })
);