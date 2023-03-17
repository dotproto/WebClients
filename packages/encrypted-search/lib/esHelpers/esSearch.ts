import { wait } from '@proton/shared/lib/helpers/promise';
import isTruthy from '@proton/utils/isTruthy';

import { AesKeyGenParams, ES_EXTRA_RESULTS_LIMIT, ES_MAX_ITEMS_PER_BATCH } from '../constants';
import { readContentBatch, readMetadataBatch, readNumMetadata, readSortedIDs } from '../esIDB';
import {
    AesGcmCiphertext,
    CachedItem,
    ESCache,
    ESItem,
    ESTimepoint,
    GetItemInfo,
    GetUserKeys,
    InternalESHelpers,
} from '../models';
import { getIndexKey } from './esBuild';
import { cacheIDB, getOldestCachedTimepoint } from './esCache';
import { normalizeString } from './esUtils';

/**
 * Process the string input by the user in the searchbar by performing the following
 * transformations:
 *   - trims whitespaces from the input string;
 *   - removes diacritics;
 *   - casts to locale lower case;
 *   - splits the input string in multiple keywords if separated by whitespace, unless
 *     it's within quotes
 * @param keyword the string as input by users in the searchbar
 * @returns the array of normalised keywords to be searched
 */
export const normalizeKeyword = (keyword: string) => {
    const trimmedKeyword = normalizeString(keyword);
    const quotesIndexes: number[] = [];

    let index = 0;
    while (index !== -1) {
        index = trimmedKeyword.indexOf(`"`, index);
        if (index !== -1) {
            quotesIndexes.push(index);
            index++;
        }
    }

    const normalizedKeywords: string[] = [];
    let previousIndex = -1;
    for (let index = 0; index < quotesIndexes.length; index++) {
        const keyword = trimmedKeyword.slice(previousIndex + 1, quotesIndexes[index]);

        if (index % 2 === 1) {
            // If the user placed quotes, we want to keep everything inside as a single block
            normalizedKeywords.push(keyword);
        } else {
            // Otherwise we split by whitespace
            normalizedKeywords.push(...keyword.split(' '));
        }

        previousIndex = quotesIndexes[index];
    }

    normalizedKeywords.push(...trimmedKeyword.slice(quotesIndexes[quotesIndexes.length - 1] + 1).split(' '));

    return normalizedKeywords.filter(isTruthy);
};

/**
 * Check if all given keywords are in any of the given strings. In other words, all given
 * keywords should be included in at least one of the searched strings
 * @param normalizedKeywords keywords to search
 * @param stringsToSearch string to be searched
 * @returns whether all keywords can be found in at least one given string
 */
export const testKeywords = (normalizedKeywords: string[], stringsToSearch: string[]) => {
    const normalizedStrings = stringsToSearch.map((str) => normalizeString(str));
    let result = true;
    let index = 0;
    while (result && index !== normalizedKeywords.length) {
        const keyword = normalizedKeywords[index];
        result = result && normalizedStrings.some((string) => string.includes(keyword));
        index++;
    }

    return result;
};

/**
 * Combine both metadata and content search, the latter only if available
 */
export const applySearch = <ESItemMetadata, ESItemContent, ESSearchParameters>(
    esSearchParams: ESSearchParameters,
    item: CachedItem<ESItemMetadata, ESItemContent>,
    esHelpers: InternalESHelpers<ESItemMetadata, ESSearchParameters, ESItemContent>
) => {
    const { applyFilters, searchKeywords, getKeywords } = esHelpers;

    const filters = applyFilters(esSearchParams, item.metadata);
    const keywords = getKeywords(esSearchParams);
    if (!filters || !keywords) {
        return filters;
    }

    return searchKeywords(keywords, item);
};

/**
 * Decrypt encrypted object from IndexedDB
 */
export const decryptFromDB = async <Plaintext>(
    aesGcmCiphertext: AesGcmCiphertext,
    indexKey: CryptoKey
): Promise<Plaintext> => {
    const textDecoder = new TextDecoder();

    const decryptedMessage: ArrayBuffer = await crypto.subtle.decrypt(
        { iv: aesGcmCiphertext.iv, name: AesKeyGenParams.name },
        indexKey,
        aesGcmCiphertext.ciphertext
    );

    return JSON.parse(textDecoder.decode(new Uint8Array(decryptedMessage)));
};

/**
 * Perfom an uncached search, i.e. with data being retrieved directly from IDB
 */
export const uncachedSearch = async <ESItemMetadata, ESItemContent, ESSearchParameters>(
    userID: string,
    indexKey: CryptoKey,
    esSearchParams: ESSearchParameters,
    esHelpers: InternalESHelpers<ESItemMetadata, ESSearchParameters, ESItemContent>,
    lastTimePoint: ESTimepoint | undefined,
    itemLimit: number,
    setIncrementalResults?: (newResults: ESItem<ESItemMetadata, ESItemContent>[]) => void,
    abortSearchingRef?: React.MutableRefObject<AbortController>
): Promise<{ resultsArray: ESItem<ESItemMetadata, ESItemContent>[]; newLastTimePoint: ESTimepoint | undefined }> => {
    const { getItemInfo, checkIsReverse } = esHelpers;

    const resultsArray: ESItem<ESItemMetadata, ESItemContent>[] = [];
    let newLastTimePoint = lastTimePoint;
    let remainingItems = itemLimit;
    let previousLenght = 0;

    const isReverse = checkIsReverse(esSearchParams);
    const remainingIDs = await readSortedIDs(userID, isReverse, newLastTimePoint);
    if (!remainingIDs) {
        return { resultsArray, newLastTimePoint };
    }

    for (let i = 0; i < remainingIDs.length; i += ES_MAX_ITEMS_PER_BATCH) {
        const IDs = remainingIDs.slice(i, i + ES_MAX_ITEMS_PER_BATCH);
        const [metadata, content] = await Promise.all([readMetadataBatch(userID, IDs), readContentBatch(userID, IDs)]);
        if (!metadata || !content || (abortSearchingRef && abortSearchingRef.current.signal.aborted)) {
            return { resultsArray, newLastTimePoint };
        }

        const data = await Promise.all(
            metadata.map(async (encryptedMetadata, index) => {
                if (abortSearchingRef && abortSearchingRef.current.signal.aborted) {
                    return;
                }

                if (!encryptedMetadata) {
                    return;
                }

                const encryptedContent = content[index];
                const [plaintextMetadata, plaintextContent] = await Promise.all([
                    decryptFromDB<ESItemMetadata>(encryptedMetadata.aesGcmCiphertext, indexKey),
                    !!encryptedContent ? decryptFromDB<ESItemContent>(encryptedContent, indexKey) : undefined,
                ]);

                return { metadata: plaintextMetadata, content: plaintextContent };
            })
        );

        if (abortSearchingRef && abortSearchingRef.current.signal.aborted) {
            return { resultsArray, newLastTimePoint };
        }

        // eslint-disable-next-line @typescript-eslint/no-loop-func
        data.forEach((item) => {
            if (!item || remainingItems === 0 || (abortSearchingRef && abortSearchingRef.current.signal.aborted)) {
                return;
            }

            if (applySearch<ESItemMetadata, ESItemContent, ESSearchParameters>(esSearchParams, item, esHelpers)) {
                newLastTimePoint = getItemInfo(item.metadata).timepoint;
                resultsArray.push({ ...item.metadata, ...item.content });
                remainingItems--;
            }
        });

        // In case the callback to show new search results while searching was given
        // and there are new search results in the current batch, show them
        if (setIncrementalResults && resultsArray.length > previousLenght) {
            previousLenght = resultsArray.length;
            setIncrementalResults(resultsArray);
        }
    }

    return { resultsArray, newLastTimePoint };
};

/**
 * Perfom a cached search, i.e. over cached items only, potentially over a partial
 * cache, i.e. still being built, therefore we need to keep track of how many
 * items were searched
 */
const cachedSearch = <ESItemMetadata, ESItemContent, ESSearchParameters>(
    iterator: IterableIterator<CachedItem<ESItemMetadata, ESItemContent>>,
    esSearchParams: ESSearchParameters,
    abortSearchingRef: React.MutableRefObject<AbortController>,
    esHelpers: InternalESHelpers<ESItemMetadata, ESSearchParameters, ESItemContent>
) => {
    const searchResults: ESItem<ESItemMetadata, ESItemContent>[] = [];
    let iteration = iterator.next();

    while (!iteration.done) {
        if (abortSearchingRef.current.signal.aborted) {
            break;
        }

        if (applySearch(esSearchParams, iteration.value, esHelpers)) {
            searchResults.push({ ...iteration.value.metadata, ...iteration.value.content });
        }

        iteration = iterator.next();
    }

    return searchResults;
};

/**
 * Based on the time boundaries of a search and the time span of a cache, check whether any more
 * items from IDB are needed. This is done because even if the cache is limited, i.e. does not fully
 * contain the whole IDB, its time span might already cover any user selected time window. It should
 * also return the first time point from where to start the uncached search and potentially adjusted
 * search parameters that take into account the new time boundaries
 */
const checkCacheTimespan = <ESItemMetadata, ESItemContent>(
    esCacheRef: React.MutableRefObject<ESCache<ESItemMetadata, ESItemContent>>,
    getItemInfo: GetItemInfo<ESItemMetadata>,
    searchTimeInterval: {
        begin: number | undefined;
        end: number | undefined;
    }
): { shouldKeepSearching: boolean; lastTimePoint?: ESTimepoint } => {
    const oldestCachedTimepoint = getOldestCachedTimepoint<ESItemMetadata>(esCacheRef, getItemInfo);
    if (!oldestCachedTimepoint) {
        return {
            shouldKeepSearching: true,
        };
    }

    const [startCache, Order] = oldestCachedTimepoint;
    const { begin, end } = searchTimeInterval;

    const beginOrder = Order;
    const intervalEnd = Math.min(startCache, end || Number.MAX_SAFE_INTEGER);
    const intervalStart = begin || 0;
    const shouldKeepSearching = intervalStart < startCache;

    return {
        shouldKeepSearching,
        lastTimePoint: [intervalEnd, beginOrder],
    };
};

/**
 * Perform a search by switching between cached and uncached search when necessary
 */
export const hybridSearch = async <ESItemMetadata, ESItemContent, ESSearchParameters>(
    esCacheRef: React.MutableRefObject<ESCache<ESItemMetadata, ESItemContent>>,
    esSearchParams: ESSearchParameters,
    cachedIndexKey: CryptoKey | undefined,
    getUserKeys: GetUserKeys,
    userID: string,
    setResultsList: (Elements: ESItem<ESItemMetadata, ESItemContent>[]) => void,
    abortSearchingRef: React.MutableRefObject<AbortController>,
    esHelpers: InternalESHelpers<ESItemMetadata, ESSearchParameters, ESItemContent>,
    minimumItems: number | undefined
) => {
    const { checkIsReverse, getItemInfo, getSearchInterval } = esHelpers;

    let searchResults: ESItem<ESItemMetadata, ESItemContent>[] = [];
    let isSearchPartial = false;
    const isReverse = checkIsReverse(esSearchParams);

    // Caching needs to be triggered here for when a refresh happens on a search URL
    const count = (await readNumMetadata(userID)) || 0;
    if (!esCacheRef.current.isCacheReady && esCacheRef.current.esCache.size === 0 && count > 0) {
        const indexKey = cachedIndexKey || (await getIndexKey(getUserKeys, userID));
        if (!indexKey) {
            throw new Error('Key not found');
        }
        void cacheIDB<ESItemMetadata, ESItemContent>(indexKey, userID, esCacheRef);
    }

    // Items in cache are the most recent ones, therefore if the cache is not ready and full and the search
    // is in descending order, we cannot used cached items
    if (isReverse || (esCacheRef.current.isCacheReady && !esCacheRef.current.isCacheLimited)) {
        // We have to wait for the cache to contain at least one message, because if it is empty the iterator
        // will be exhausted immediately and will not loop over newly inserted messages when they'll come in
        while (esCacheRef.current.esCache.size === 0) {
            await wait(200);
        }

        const iterator = esCacheRef.current.esCache.values();
        searchResults = cachedSearch<ESItemMetadata, ESItemContent, ESSearchParameters>(
            iterator,
            esSearchParams,
            abortSearchingRef,
            esHelpers
        );
        let resultsCounter = searchResults.length;

        // The first batch of results (if any) are shown only if the cache is still being built, or if it has finished
        // but it's limited. Otherwise we want to show all results at the end
        if (resultsCounter !== 0 && (!esCacheRef.current.isCacheReady || esCacheRef.current.isCacheLimited)) {
            setResultsList(searchResults);
        }

        // If the cache is still being built, incremental portions of cache are searched
        while (!esCacheRef.current.isCacheReady) {
            if (abortSearchingRef.current.signal.aborted) {
                return {
                    searchResults,
                    isSearchPartial,
                };
            }

            searchResults.push(
                ...cachedSearch<ESItemMetadata, ESItemContent, ESSearchParameters>(
                    iterator,
                    esSearchParams,
                    abortSearchingRef,
                    esHelpers
                )
            );

            // In case there are new results, we show them
            if (searchResults.length > resultsCounter) {
                setResultsList(searchResults);
            }

            resultsCounter = searchResults.length;
            await wait(200);
        }

        // To avoid any race condition at the end of the while loop, one last search of the very last portion
        // is performed
        searchResults.push(
            ...cachedSearch<ESItemMetadata, ESItemContent, ESSearchParameters>(
                iterator,
                esSearchParams,
                abortSearchingRef,
                esHelpers
            )
        );

        // Once caching has terminated, if the cache turns out to be not limited, we stop searching
        if (!esCacheRef.current.isCacheLimited || abortSearchingRef.current.signal.aborted) {
            return {
                searchResults,
                isSearchPartial,
            };
        }

        // If enough items to fill two pages were already found, we don't continue the search
        if (searchResults.length >= 2 * ES_EXTRA_RESULTS_LIMIT || abortSearchingRef.current.signal.aborted) {
            // The last item in cache is assumed to be the oldest
            const lastTimePoint = getOldestCachedTimepoint<ESItemMetadata>(esCacheRef, getItemInfo);
            return {
                searchResults,
                isSearchPartial: true,
                lastTimePoint,
            };
        }

        // If there were more results in the last batch, we show them before continuing with uncached search
        if (searchResults.length > resultsCounter) {
            setResultsList(searchResults);
        }
    }

    let shouldKeepSearching = !abortSearchingRef.current.signal.aborted;
    let lastTimePoint: ESTimepoint | undefined;
    isSearchPartial = true;

    // If the cache hasn't been searched because the order is ascending, the search
    // parameters shouldn't be influenced by the cache timespan
    if (isReverse) {
        // The remaining items are searched from DB, but only if the indicated timespan
        // hasn't been already covered by cache. The cache is ordered such that the last item is the oldest
        ({ shouldKeepSearching, lastTimePoint } = checkCacheTimespan<ESItemMetadata, ESItemContent>(
            esCacheRef,
            getItemInfo,
            getSearchInterval(esSearchParams)
        ));
    }

    const remainingItems = Math.max(2 * ES_EXTRA_RESULTS_LIMIT - searchResults.length, minimumItems || 0);
    if (shouldKeepSearching && remainingItems > 0) {
        const setIncrementalResults = (newResults: ESItem<ESItemMetadata, ESItemContent>[]) => {
            setResultsList(searchResults.concat(newResults));
        };

        const indexKey = cachedIndexKey || (await getIndexKey(getUserKeys, userID));
        if (!indexKey) {
            throw new Error('Key not found');
        }

        const { resultsArray, newLastTimePoint } = await uncachedSearch<
            ESItemMetadata,
            ESItemContent,
            ESSearchParameters
        >(
            userID,
            indexKey,
            esSearchParams,
            esHelpers,
            lastTimePoint,
            remainingItems,
            setIncrementalResults,
            abortSearchingRef
        );
        searchResults.push(...resultsArray);
        isSearchPartial = !!newLastTimePoint;
        lastTimePoint = newLastTimePoint;
    }

    return { searchResults, isSearchPartial, lastTimePoint };
};
