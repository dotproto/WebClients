import browser from '@proton/pass/globals/browser';
import { itemAutofillIntent, itemUsed, selectAutofillCandidates, selectItemByShareIdAndId } from '@proton/pass/store';
import type { Maybe, MaybeNull, Realm, SafeLoginItem } from '@proton/pass/types';
import { WorkerMessageType } from '@proton/pass/types';
import { parseSender, parseUrl } from '@proton/pass/utils/url';

import { setPopupIconBadge } from '../../shared/extension';
import WorkerMessageBroker from '../channel';
import { onContextReady } from '../context';
import store from '../store';

export const createAutoFillService = () => {
    const getAutofillCandidates = (options: { realm: Realm; subdomain: MaybeNull<string> }): SafeLoginItem[] =>
        selectAutofillCandidates(
            options.realm,
            options.subdomain
        )(store.getState()).map((item) => ({
            name: item.data.metadata.name,
            username: item.data.content.username,
            itemId: item.itemId,
            shareId: item.shareId,
        }));

    const getAutofillData = ({
        shareId,
        itemId,
    }: {
        shareId: string;
        itemId: string;
    }): Maybe<{ username: string; password: string }> => {
        const state = store.getState();
        const item = selectItemByShareIdAndId(shareId, itemId)(state);

        if (item !== undefined && item.data.type === 'login') {
            store.dispatch(itemAutofillIntent({ shareId, itemId }));
            return {
                username: item.data.content.username,
                password: item.data.content.password,
            };
        }
    };

    const updateTabsBadgeCount = async () => {
        try {
            const tabs = await browser.tabs.query({});
            await Promise.all(
                tabs.map(({ id: tabId, url, active }) => {
                    const { domain: realm, subdomain } = parseUrl(url ?? '');
                    if (tabId && realm) {
                        const items = getAutofillCandidates({ realm, subdomain });
                        const count = items.length;

                        if (active) {
                            WorkerMessageBroker.ports.broadcast(
                                {
                                    type: WorkerMessageType.AUTOFILL_SYNC,
                                    payload: { count },
                                },
                                (name) => name.startsWith(`content-script-${tabId}`)
                            );
                        }

                        return setPopupIconBadge(tabId, count);
                    }
                })
            );
        } catch (_) {}
    };

    /**
     * Clears badge count for each valid tab
     * Triggered on logout detection to avoid
     * showing stale counts
     */
    const clearTabsBadgeCount = async (): Promise<void> => {
        try {
            const tabs = await browser.tabs.query({});
            await Promise.all(tabs.map(({ id: tabId }) => tabId && setPopupIconBadge(tabId, 0)));
        } catch (_) {}
    };

    WorkerMessageBroker.registerMessage(
        WorkerMessageType.AUTOFILL_QUERY,
        onContextReady((_, sender) => {
            const { realm, tabId, subdomain } = parseSender(sender);
            const items = getAutofillCandidates({ realm, subdomain });

            return { items: tabId !== undefined && items.length > 0 ? items : [] };
        })
    );

    WorkerMessageBroker.registerMessage(
        WorkerMessageType.AUTOFILL_SELECT,
        onContextReady(async (message) => {
            const credentials = getAutofillData(message.payload);

            if (credentials === undefined) {
                throw new Error('Could not get credentials for autofill request');
            }

            store.dispatch(itemUsed(message.payload));
            return credentials;
        })
    );

    /**
     * onUpdated will be triggered every time a tab
     * has been loaded with a new url : update the
     * badge count accordingly
     */
    browser.tabs.onUpdated.addListener(
        onContextReady(async (tabId, _, tab) => {
            const { domain: realm, subdomain } = parseUrl(tab.url ?? '');

            if (tabId && realm) {
                const items = getAutofillCandidates({ realm, subdomain });
                return setPopupIconBadge(tabId, items.length);
            }
        })
    );

    return { getAutofillCandidates, updateTabsBadgeCount, clearTabsBadgeCount };
};

export type AutoFillService = ReturnType<typeof createAutoFillService>;