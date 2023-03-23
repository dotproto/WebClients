import { call, put, takeLeading } from 'redux-saga/effects';
import { c } from 'ttag';
import uniqid from 'uniqid';

import { ItemRevision, ItemRevisionContentsResponse, Maybe } from '@proton/pass/types';
import { logger } from '@proton/pass/utils/logger';
import { getApiErrorMessage } from '@proton/shared/lib/api/helpers/apiErrorHelper';
import chunk from '@proton/utils/chunk';

import {
    importItemsRequest,
    importItemsRequestFailure,
    importItemsRequestSuccess,
    itemsImported,
    notification,
    vaultCreationIntent,
    vaultCreationSuccess,
} from '../actions';
import { WorkerRootSagaOptions } from '../types';
import { importItemsBatch, parseItemRevision } from './workers/items';

/**
 * When creating vaults from the import saga
 * we want to internally trigger any saga that
 * may result from vaultCreationSuccess (notably
 * the event-loop channel updates) : leverage
 * the withCallback vaultCreationIntent to await
 * the vault creation result
 */
function* createVaultForImport(vaultName: string) {
    const date = new Date().toLocaleDateString();
    let resolver: (shareId: Maybe<string>) => void;
    const creationResult = new Promise<Maybe<string>>((res) => (resolver = res));

    yield put(
        vaultCreationIntent(
            { id: uniqid(), content: { name: vaultName, description: c('Info').t`Imported on ${date}` } },
            (action) => (vaultCreationSuccess.match(action) ? resolver(action.payload.share.shareId) : undefined)
        )
    );

    const shareId: Maybe<string> = yield creationResult;

    if (shareId === undefined) {
        throw new Error(c('Warning').t`Could not create vault "${vaultName}"`);
    }

    return shareId;
}

function* importWorker(
    { onItemsChange }: WorkerRootSagaOptions,
    { payload: { data }, meta }: ReturnType<typeof importItemsRequest>
) {
    let total: number = 0;

    try {
        /**
         * we want to apply these request sequentially to avoid
         * swarming the network with too many parallel requests
         */
        for (const vaultData of data) {
            try {
                const shareId: string =
                    vaultData.type === 'existing'
                        ? vaultData.vaultId
                        : yield call(createVaultForImport, vaultData.vaultName);

                for (const batch of chunk(vaultData.items, 50)) {
                    try {
                        const revisions: ItemRevisionContentsResponse[] = yield importItemsBatch(shareId, batch);
                        const items: ItemRevision[] = yield Promise.all(
                            revisions.map((revision) => parseItemRevision(shareId, revision))
                        );

                        total += revisions.length;

                        yield put(itemsImported({ shareId, items }));
                    } catch (e) {
                        const description = e instanceof Error ? getApiErrorMessage(e) ?? e?.message : '';

                        yield put(
                            notification({
                                target: meta.receiver,
                                type: 'error',
                                text: c('Error').t`Import failed for vault "${vaultData.vaultName}" : ${description}`,
                            })
                        );
                    }
                }
            } catch (e) {
                logger.warn('[Saga::Import]', e);
                yield put(
                    notification({
                        target: meta.receiver,
                        type: 'error',
                        text: c('Error').t`Vault "${vaultData.vaultName}" could not be created`,
                    })
                );
            }
        }

        yield put(importItemsRequestSuccess({ total }, meta.receiver));
        onItemsChange?.();
    } catch (error: any) {
        yield put(importItemsRequestFailure(error, meta.receiver));
    }
}

export default function* watcher(options: WorkerRootSagaOptions) {
    yield takeLeading(importItemsRequest.match, importWorker, options);
}