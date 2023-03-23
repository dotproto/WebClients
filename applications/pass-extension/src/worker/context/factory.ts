import { backgroundMessage } from '@proton/pass/extension/message';
import { acknowledge } from '@proton/pass/store';
import { unlockSession } from '@proton/pass/store/actions/requests';
import type { Api } from '@proton/pass/types';
import { WorkerMessageType, WorkerStatus } from '@proton/pass/types';
import { waitUntil } from '@proton/pass/utils/fp';
import { logger } from '@proton/pass/utils/logger';
import { workerLoggedOut, workerReady, workerStatusResolved } from '@proton/pass/utils/worker';
import { setUID as setSentryUID } from '@proton/shared/lib/helpers/sentry';
import noop from '@proton/utils/noop';

import { setPopupIcon } from '../../shared/extension';
import WorkerMessageBroker from '../channel';
import { createActivationService } from '../services/activation';
import { createAliasService } from '../services/alias';
import { createAuthService } from '../services/auth';
import { createAutoFillService } from '../services/autofill';
import { createAutoSaveService } from '../services/autosave';
import { createCacheProxyService } from '../services/cache-proxy';
import { createExportService } from '../services/export';
import { createFormTrackerService } from '../services/form.tracker';
import { createSettingsService } from '../services/settings';
import { createStoreService } from '../services/store';
import store from '../store';
import { WorkerContext } from './context';
import { withContext } from './helpers';

export const createWorkerContext = (options: { api: Api; status: WorkerStatus }) => {
    const auth = createAuthService({
        api: options.api,
        onAuthorized: withContext((ctx) => {
            ctx.service.activation.boot();
            ctx.service.autofill.updateTabsBadgeCount().catch(noop);
            setSentryUID(auth.authStore.getUID());
            store.dispatch(acknowledge(unlockSession));
        }),
        onUnauthorized: withContext((ctx) => {
            ctx.service.autofill.clearTabsBadgeCount().catch(noop);
            ctx.service.formTracker.clear();
            setSentryUID(undefined);
        }),
    });

    const context = WorkerContext.set({
        status: options.status,
        service: {
            auth,
            activation: createActivationService(),
            alias: createAliasService(),
            autofill: createAutoFillService(),
            autosave: createAutoSaveService(),
            cacheProxy: createCacheProxyService(),
            export: createExportService(),
            formTracker: createFormTrackerService(),
            settings: createSettingsService(),
            store: createStoreService(),
        },

        async ensureReady() {
            const context = WorkerContext.get();
            await waitUntil(() => workerStatusResolved(context.getState().status), 50);

            return context;
        },

        getState: () => ({
            loggedIn: auth.authStore.hasSession() && workerReady(context.status),
            status: context.status,
            UID: auth.authStore.getUID(),
        }),

        setStatus(status: WorkerStatus) {
            logger.info(`[Worker::Context] Status update : ${context.status} -> ${status}`);
            context.status = status;

            if (workerLoggedOut(status)) {
                setPopupIcon({ loggedIn: false }).catch(noop);
            }

            if (workerReady(status)) {
                setPopupIcon({ loggedIn: true }).catch(noop);
            }

            WorkerMessageBroker.ports.broadcast(
                backgroundMessage({
                    type: WorkerMessageType.WORKER_STATUS,
                    payload: { state: context.getState() },
                })
            );
        },

        async init({ sync, force }) {
            const shouldInit = Boolean((sync ?? !workerReady(context.status)) || force);
            const shouldBoot = shouldInit && (await auth.init());

            if (shouldBoot) {
                context.service.activation.boot();
            }

            return context;
        },
    });

    return context;
};