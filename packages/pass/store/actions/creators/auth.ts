import { createAction } from '@reduxjs/toolkit';
import { c } from 'ttag';

import { pipe } from '@proton/pass/utils/fp';
import { PASS_APP_NAME } from '@proton/shared/lib/constants';

import { settingsEdit, unlockSession } from '../requests';
import withCacheBlock from '../with-cache-block';
import withNotification from '../with-notification';
import withRequest from '../with-request';

export const signout = createAction('signout', (payload: { soft: boolean }) => withCacheBlock({ payload }));
export const signoutSuccess = createAction('signout success', (payload: { soft: boolean }) =>
    withCacheBlock({ payload })
);

export const sessionLockEnableIntent = createAction('enable session lock', (payload: { pin: string; ttl: number }) =>
    pipe(withCacheBlock, withRequest({ id: settingsEdit('session-lock'), type: 'start' }))({ payload })
);

export const sessionLockEnableFailure = createAction('enable session lock failure', (error: unknown) =>
    pipe(
        withCacheBlock,
        withRequest({ id: settingsEdit('session-lock'), type: 'failure' }),
        withNotification({
            type: 'error',
            text: c('Error').t`Auto-lock could not be activated`,
            error,
        })
    )({ payload: {}, error })
);

export const sessionLockEnableSuccess = createAction(
    'enable session lock success',
    (payload: { storageToken: string }) =>
        pipe(
            withRequest({ id: settingsEdit('session-lock'), type: 'success' }),
            withNotification({
                type: 'info',
                text: c('Info').t`PIN code successfully registered. Use it to unlock ${PASS_APP_NAME}`,
            })
        )({ payload })
);

export const sessionLockDisableIntent = createAction('disable session lock', (payload: { pin: string }) =>
    pipe(
        withCacheBlock,
        withRequest({
            id: settingsEdit('session-lock'),
            type: 'start',
        })
    )({ payload })
);

export const sessionLockDisableFailure = createAction('disable session lock failure', (error: unknown) =>
    pipe(
        withCacheBlock,
        withRequest({ id: settingsEdit('session-lock'), type: 'failure' }),
        withNotification({
            type: 'error',
            text: c('Error').t`Auto-lock could not be disabled`,
            error,
        })
    )({ payload: {}, error })
);

export const sessionLockDisableSuccess = createAction('disable session lock success', () =>
    pipe(
        withRequest({ id: settingsEdit('session-lock'), type: 'success' }),
        withNotification({
            type: 'info',
            text: c('Info').t`Auto-lock successfully disabled`,
        })
    )({ payload: {} })
);

export const sessionUnlockIntent = createAction('unlock session lock', (payload: { pin: string }) =>
    pipe(
        withCacheBlock,
        withRequest({
            id: unlockSession,
            type: 'start',
        })
    )({ payload })
);

export const sessionUnlockFailure = createAction('unlock session lock failure', (error: unknown) =>
    pipe(
        withCacheBlock,
        withRequest({ id: unlockSession, type: 'failure' }),
        withNotification({
            type: 'error',
            text: c('Error').t`Failed to unlock`,
            error,
        })
    )({ payload: {}, error })
);

export const sessionUnlockSuccess = createAction('unlock session lock success', () =>
    pipe(
        withCacheBlock,
        withRequest({
            id: unlockSession,
            type: 'success',
        })
    )({ payload: {} })
);
