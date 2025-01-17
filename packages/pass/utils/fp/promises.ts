import type { MaybeNull } from '../../types';

type UnwrapPromise<T> = T extends any[] ? { [K in keyof T]: UnwrapPromise<T[K]> } : T extends Promise<infer U> ? U : T;

/**
 * this util will recursively unwrap promises in any
 * list like structure - it is useful in when working
 * with asynchronous & deeply nested data-structures.
 *
 * await unwrap([1,2,Promise.resolve(3)]) // [1,2,3]
 * await unwrap([1,2,[Promise.resolve(3)]) // [1,2,[3]]
 * await unwrap([[Promise.resolve(1)],[Promise.resolve(2)]]) // [[1],[2]]
 */
export const unwrap = async <T extends any[]>(arr: [...T]): Promise<UnwrapPromise<T>> =>
    Promise.all(arr.map((value) => (Array.isArray(value) ? unwrap(value) : value))) as Promise<UnwrapPromise<T>>;

type Awaiter<T> = Promise<T> & { resolve: (value: T | PromiseLike<T>) => void };

export const awaiter = <T>(): Awaiter<T> => {
    let resolver: ((value: T | PromiseLike<T>) => void) | undefined;
    const promise = new Promise<T>((resolve) => (resolver = resolve)) as Awaiter<T>;
    if (resolver) promise.resolve = resolver;

    return promise;
};

export const asyncLock = <P extends any[], R extends Promise<any>, F extends (...args: P) => R>(fn: F): F => {
    const ctx: { pending: MaybeNull<Promise<R>> } = { pending: null };

    return (async (...args: P) => {
        if (ctx.pending !== null) return ctx.pending;
        ctx.pending = fn(...args);

        return ctx.pending.finally(() => (ctx.pending = null));
    }) as F;
};
