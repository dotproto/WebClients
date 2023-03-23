import type { AnyAction, Reducer } from 'redux';

import { CONTENT_FORMAT_VERSION, type ItemRevision, ItemState } from '@proton/pass/types';
import { fullMerge, objectDelete, partialMerge } from '@proton/pass/utils/object';
import { isTrashed } from '@proton/pass/utils/pass/trash';
import { getEpoch } from '@proton/pass/utils/time';
import { toMap } from '@proton/shared/lib/helpers/object';

import {
    bootSuccess,
    disabledShareEvent,
    emptyTrashFailure,
    emptyTrashIntent,
    emptyTrashSuccess,
    itemAutofillIntent,
    itemCreationDismiss,
    itemCreationFailure,
    itemCreationIntent,
    itemCreationSuccess,
    itemDeleteFailure,
    itemDeleteIntent,
    itemDeleteSuccess,
    itemDeleteSync,
    itemEditDismiss,
    itemEditFailure,
    itemEditIntent,
    itemEditSuccess,
    itemEditSync,
    itemLastUseTimeUpdated,
    itemRestoreFailure,
    itemRestoreIntent,
    itemRestoreSuccess,
    itemTrashFailure,
    itemTrashIntent,
    itemTrashSuccess,
    itemsImported,
    itemsRequestSuccess,
    restoreTrashFailure,
    restoreTrashIntent,
    restoreTrashSuccess,
    syncSuccess,
    vaultDeleteSuccess,
} from '../actions';
import { sanitizeWithCallbackAction } from '../actions/with-callback';
import { WrappedOptimisticState } from '../optimistic/types';
import { combineOptimisticReducers } from '../optimistic/utils/combine-optimistic-reducers';
import withOptimistic from '../optimistic/with-optimistic';

/*
 * itemIds are only guaranteed to be unique per share
 * not globally, therefore it must be nested like this
 */
export type ItemsByShareId = {
    [shareId: string]: {
        [itemId: string]: ItemRevision;
    };
};

type ItemIdByOptimisticId = { [optimisticId: string]: string };

export type ItemsState = {
    byShareId: WrappedOptimisticState<ItemsByShareId>;
    byOptimistcId: ItemIdByOptimisticId;
};

export const withOptimisticItemsByShareId = withOptimistic<ItemsByShareId>(
    [
        {
            initiate: itemCreationIntent.optimisticMatch,
            fail: itemCreationFailure.optimisticMatch,
            revert: [itemCreationSuccess.optimisticMatch, itemCreationDismiss.optimisticMatch],
        },
        {
            initiate: itemEditIntent.optimisticMatch,
            fail: itemEditFailure.optimisticMatch,
            commit: itemEditSuccess.optimisticMatch,
            revert: itemEditDismiss.optimisticMatch,
        },
        {
            initiate: itemTrashIntent.optimisticMatch,
            commit: itemTrashSuccess.optimisticMatch,
            revert: itemTrashFailure.optimisticMatch,
        },
        {
            initiate: itemRestoreIntent.optimisticMatch,
            commit: itemRestoreSuccess.optimisticMatch,
            revert: itemRestoreFailure.optimisticMatch,
        },
        {
            initiate: itemDeleteIntent.optimisticMatch,
            commit: itemDeleteSuccess.optimisticMatch,
            revert: itemDeleteFailure.optimisticMatch,
        },
        {
            initiate: restoreTrashIntent.match,
            commit: restoreTrashSuccess.match,
            revert: restoreTrashFailure.match,
        },
        {
            initiate: emptyTrashIntent.match,
            commit: emptyTrashSuccess.match,
            revert: emptyTrashFailure.match,
        },
    ],
    (state = {}, action: AnyAction) => {
        if (bootSuccess.match(action) && action.payload.sync?.items !== undefined) {
            return action.payload.sync.items;
        }

        if (syncSuccess.match(action)) {
            return action.payload.items;
        }

        if (itemCreationIntent.match(action)) {
            const { shareId, optimisticId, createTime, ...item } = action.payload;
            const optimisticItem = state?.[shareId]?.[optimisticId];

            /**
             * FIXME: we could rely on an optimistic revisionTime update
             * optimistically bump the revision number in the case of retries,
             * the correct revision number will be set on item creation success.
             * This allows this item to be correctly marked as failed.
             */
            return fullMerge(state, {
                [shareId]: {
                    [optimisticId]: {
                        itemId: optimisticId,
                        shareId: shareId,
                        revision: optimisticItem !== undefined ? optimisticItem.revision + 1 : 0,
                        data: item,
                        aliasEmail: item.type === 'alias' ? item.extraData.aliasEmail : null,
                        state: ItemState.Active,
                        createTime,
                        modifyTime: createTime,
                        revisionTime: createTime,
                        lastUseTime: null,
                        contentFormatVersion: CONTENT_FORMAT_VERSION,
                    },
                },
            });
        }

        if (itemCreationSuccess.match(action)) {
            const { shareId, item } = action.payload;

            return fullMerge(state, { [shareId]: { [item.itemId]: item } });
        }

        if (itemsImported.match(action)) {
            const { shareId, items } = action.payload;
            return fullMerge(state, { [shareId]: toMap(items, 'itemId') });
        }

        if (itemTrashIntent.match(action)) {
            const {
                item: { itemId },
                shareId,
            } = action.payload;

            return partialMerge(state, { [shareId]: { [itemId]: { state: ItemState.Trashed } } });
        }

        if (itemRestoreIntent.match(action)) {
            const {
                item: { itemId },
                shareId,
            } = action.payload;

            return partialMerge(state, { [shareId]: { [itemId]: { state: ItemState.Active } } });
        }

        if (itemEditIntent.match(action)) {
            const { shareId, itemId, ...item } = action.payload;
            const { revision } = state[shareId][itemId];

            /**
             * FIXME: see `itemCreationIntent.match`
             * optimistically bump the revision number in the case of retries,
             * the correct revision number will be set on item edit success.
             * This allows this item to be correctly marked as failed.
             */
            return partialMerge(state, {
                [shareId]: { [itemId]: { data: item, revision: revision + 1 } },
            });
        }

        if (itemEditSuccess.match(action) || itemEditSync.match(action)) {
            const { shareId, item } = action.payload;
            const { itemId } = item;

            return fullMerge(state, { [shareId]: { [itemId]: item } });
        }

        if (itemLastUseTimeUpdated.match(action)) {
            const { shareId, itemId, lastUseTime } = action.payload;

            return partialMerge(state, { [shareId]: { [itemId]: { lastUseTime } } });
        }

        if (itemDeleteIntent.match(action)) {
            const { shareId, item } = action.payload;

            return { ...state, [shareId]: objectDelete(state[shareId], item.itemId) };
        }

        if (itemDeleteSync.match(action)) {
            const { shareId, itemId } = action.payload;

            return { ...state, [shareId]: objectDelete(state[shareId], itemId) };
        }

        if (emptyTrashIntent.match(action)) {
            return Object.fromEntries(
                Object.entries(state).map(([shareId, itemsById]) => [
                    shareId,
                    Object.entries(itemsById).reduce(
                        (reduction, [itemId, item]) =>
                            isTrashed(item) ? reduction : fullMerge(reduction, { [itemId]: item }),
                        {}
                    ),
                ])
            );
        }

        if (restoreTrashIntent.match(action)) {
            return Object.fromEntries(
                Object.entries(state).map(([shareId, itemsById]) => [
                    shareId,
                    Object.fromEntries(
                        Object.entries(itemsById).map(([itemId, item]) => [
                            itemId,
                            isTrashed(item) ? partialMerge(item, { state: ItemState.Active }) : item,
                        ])
                    ),
                ])
            );
        }

        if (itemsRequestSuccess.match(action)) {
            const {
                payload: { shareId, items },
            } = action;

            const itemsById = items.reduce((reduction, item) => ({ ...reduction, [item.itemId]: item }), {});

            return fullMerge(state, { [shareId]: itemsById });
        }

        if (itemAutofillIntent.match(action)) {
            const {
                payload: { shareId, itemId },
            } = action;

            return partialMerge(state, { [shareId]: { [itemId]: { lastUseTime: getEpoch() } } });
        }

        if (vaultDeleteSuccess.match(action)) {
            return objectDelete(state, action.payload.id);
        }

        if (disabledShareEvent.match(action)) {
            return objectDelete(state, action.payload.shareId);
        }

        return state;
    },
    { sanitizeAction: sanitizeWithCallbackAction }
);

const itemIdByOptimisticId: Reducer<ItemIdByOptimisticId> = (state = {}, action) => {
    if (itemCreationSuccess.match(action)) {
        const { optimisticId, item } = action.payload;

        return fullMerge(state, { [optimisticId]: item.itemId });
    }

    return state;
};

export default combineOptimisticReducers({
    byShareId: withOptimisticItemsByShareId.reducer,
    byOptimistcId: itemIdByOptimisticId,
});