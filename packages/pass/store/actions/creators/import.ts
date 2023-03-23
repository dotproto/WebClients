import { createAction } from '@reduxjs/toolkit';
import { c, msgid } from 'ttag';

import { ImportPayload } from '@proton/pass/import';
import { ExtensionEndpoint, ItemRevision } from '@proton/pass/types';
import { pipe } from '@proton/pass/utils/fp';

import * as requests from '../requests';
import withCacheBlock from '../with-cache-block';
import withNotification from '../with-notification';
import withReceiver from '../with-receiver';
import withRequest from '../with-request';

export const importItemsRequest = createAction(
    'import items request',
    (payload: { data: ImportPayload }, endpoint?: ExtensionEndpoint) =>
        pipe(
            withCacheBlock,
            withReceiver({ receiver: endpoint }),
            withRequest({
                id: requests.importItems(),
                type: 'start',
            })
        )({ payload })
);

export const importItemsRequestSuccess = createAction(
    'import items success',
    ({ total }: { total: number }, target?: ExtensionEndpoint) =>
        pipe(
            withCacheBlock,
            withRequest({
                id: requests.importItems(),
                type: 'success',
            }),
            withNotification({
                type: 'info',
                target,
                text: c('Info').ngettext(msgid`Imported ${total} item`, `Imported ${total} items`, total),
            })
        )({ payload: { total } })
);

export const importItemsRequestFailure = createAction(
    'import items failure',
    (error: unknown, target?: ExtensionEndpoint) =>
        pipe(
            withCacheBlock,
            withRequest({
                id: requests.importItems(),
                type: 'failure',
            }),
            withNotification({
                type: 'error',
                target,
                text: c('Error').t`Importing items failed`,
                error,
            })
        )({ payload: {}, error })
);

export const itemsImported = createAction('item imported', (payload: { shareId: string; items: ItemRevision[] }) =>
    withCacheBlock({ payload })
);