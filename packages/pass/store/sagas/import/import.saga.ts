import { call, put, takeLeading } from 'redux-saga/effects';
import { c } from 'ttag';

import { MAX_BATCH_ITEMS_PER_REQUEST } from '@proton/pass/constants';
import { importItemsBatch } from '@proton/pass/lib/items/item.requests';
import { parseItemRevision } from '@proton/pass/lib/items/item.utils';
import { createTelemetryEvent } from '@proton/pass/lib/telemetry/event';
import {
    importItemsFailure,
    importItemsIntent,
    importItemsSuccess,
    itemsBatchImported,
    notification,
    startEventPolling,
    stopEventPolling,
    vaultCreationIntent,
    vaultCreationSuccess,
} from '@proton/pass/store/actions';
import type { WithSenderAction } from '@proton/pass/store/actions/with-receiver';
import type { WorkerRootSagaOptions } from '@proton/pass/store/types';
import type { ItemRevision, ItemRevisionContentsResponse, Maybe } from '@proton/pass/types';
import { TelemetryEventName } from '@proton/pass/types/data/telemetry';
import { logger } from '@proton/pass/utils/logger';
import { uniqueId } from '@proton/pass/utils/string/unique-id';
import { getEpoch } from '@proton/pass/utils/time/get-epoch';
import { getApiErrorMessage } from '@proton/shared/lib/api/helpers/apiErrorHelper';
import capitalize from '@proton/utils/capitalize';
import chunk from '@proton/utils/chunk';
import groupWith from '@proton/utils/groupWith';

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
            {
                id: uniqueId(),
                content: { name: vaultName, description: c('Info').t`Imported on ${date}`, display: {} },
            },
            (action) => resolver(vaultCreationSuccess.match(action) ? action.payload.share.shareId : undefined)
        )
    );

    const shareId: Maybe<string> = yield creationResult;
    if (shareId === undefined) throw new Error(c('Warning').t`Could not create vault "${vaultName}"`);

    return shareId;
}

function* importWorker(
    { onItemsChange, onImportProgress, getTelemetry }: WorkerRootSagaOptions,
    { payload: { data, provider }, meta }: WithSenderAction<ReturnType<typeof importItemsIntent>>
) {
    const telemetry = getTelemetry();
    yield put(stopEventPolling());

    let totalItems: number = 0;
    const ignored: string[] = data.ignored;
    const importVaults = groupWith((a, b) => a.shareId === b.shareId, data.vaults).map((group) => ({
        ...group[0],
        items: group.flatMap(({ items }) => items),
    }));

    try {
        /* we want to apply these request sequentially to avoid
         * swarming the network with too many parallel requests */
        for (const vaultData of importVaults) {
            try {
                const shareId: string = vaultData.shareId ?? (yield call(createVaultForImport, vaultData.name));

                for (const batch of chunk(vaultData.items, MAX_BATCH_ITEMS_PER_REQUEST)) {
                    try {
                        const revisions: ItemRevisionContentsResponse[] = yield importItemsBatch({
                            shareId,
                            importIntents: batch,
                            onSkippedItem: ({ type, metadata }) =>
                                ignored.push(`[${capitalize(type)}] ${metadata.name}`),
                        });

                        const items: ItemRevision[] = yield Promise.all(
                            revisions.map((revision) => parseItemRevision(shareId, revision))
                        );

                        totalItems += revisions.length;

                        onImportProgress?.(totalItems, meta.sender?.endpoint);
                        yield put(itemsBatchImported({ shareId, items }));
                    } catch (e) {
                        const description = e instanceof Error ? getApiErrorMessage(e) ?? e?.message : '';
                        ignored.push(...batch.map((item) => `[${capitalize(item.type)}] ${item.metadata.name}`));

                        yield put(
                            notification({
                                receiver: meta.sender?.endpoint,
                                key: meta.request.id,
                                type: 'error',
                                text: c('Error').t`Import failed for vault "${vaultData.name}" : ${description}`,
                            })
                        );
                    }
                }
            } catch (e) {
                logger.warn('[Saga::Import]', e);
                yield put(
                    notification({
                        key: meta.request.id,
                        receiver: meta.sender?.endpoint,
                        type: 'error',
                        text: c('Error').t`Vault "${vaultData.name}" could not be created`,
                    })
                );
            }
        }

        void telemetry?.pushEvent(
            createTelemetryEvent(
                TelemetryEventName.ImportCompletion,
                { item_count: totalItems, vaults: importVaults.length },
                { source: provider }
            )
        );

        yield put(
            importItemsSuccess(
                {
                    provider,
                    ignored,
                    total: totalItems,
                    importedAt: getEpoch(),
                    warnings: data.warnings,
                },
                meta.sender?.endpoint
            )
        );
        onItemsChange?.();
    } catch (error: any) {
        yield put(importItemsFailure(error, meta.sender?.endpoint));
    } finally {
        yield put(startEventPolling());
    }
}

export default function* watcher(options: WorkerRootSagaOptions) {
    yield takeLeading(importItemsIntent.match, importWorker, options);
}
