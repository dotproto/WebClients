import { put, takeEvery } from 'redux-saga/effects';

import { api } from '@proton/pass/api';
import { PassCrypto } from '@proton/pass/crypto';

import { vaultDeleteFailure, vaultDeleteIntent, vaultDeleteSuccess } from '../actions';
import type { WorkerRootSagaOptions } from '../types';

function* deleteVault(
    { onItemsChange }: WorkerRootSagaOptions,
    { payload: { id, content } }: ReturnType<typeof vaultDeleteIntent>
): Generator {
    try {
        yield api({ url: `pass/v1/vault/${id}`, method: 'delete' });
        PassCrypto.removeShare(id);

        yield put(vaultDeleteSuccess({ id, content }));
        onItemsChange?.();
    } catch (e) {
        yield put(vaultDeleteFailure({ id, content }, e));
    }
}

export default function* watcher(options: WorkerRootSagaOptions) {
    yield takeEvery(vaultDeleteIntent.match, deleteVault, options);
}