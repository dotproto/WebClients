import path from 'path';
import webpack from 'webpack';
import 'webpack-dev-server';
// @ts-ignore
import { parseResource } from 'webpack/lib/util/identifier';

const { getJsLoaders } = require('./webpack/js.loader');
const getCssLoaders = require('./webpack/css.loader');
const getAssetsLoaders = require('./webpack/assets.loader');
const getPlugins = require('./webpack/plugins');
const getOptimizations = require('./webpack/optimization');

const getConfig = (env: any): webpack.Configuration => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isRelease = !!process.env.CI_COMMIT_TAG;

    const options = {
        isProduction,
        isRelease,
        publicPath: env.publicPath || '/',
        api: env.api,
        appMode: env.appMode || 'standalone',
        featureFlags: env.featureFlags || '',
        writeSRI: env.writeSri !== 'false',
        browserslist: isProduction
            ? `> 0.5%, not IE 11, Firefox ESR, Safari 11`
            : 'last 1 chrome version, last 1 firefox version, last 1 safari version',
        buildData: {
            version: env.version,
            commit: env.commit,
            branch: env.branch,
            date: env.date,
            mode: env.appMode,
        },
        warningLogs: env.warningLogs || false,
        errorLogs: env.errorLogs || false,
        overlayWarnings: env.overlayWarnings || false,
        overlayErrors: env.overlayErrors || false,
        overlayRuntimeErrors: env.overlayRuntimeErrors || false,
        logical: env.logical || false,
    };

    return {
        target: `browserslist:${options.browserslist}`,
        mode: options.isProduction ? 'production' : 'development',
        bail: options.isProduction,
        devtool: options.isProduction ? 'source-map' : 'cheap-module-source-map',
        watchOptions: {
            ignored: /node_modules|(i18n\/*.json)|\*\.(gif|jpeg|jpg|ico|png)/,
            aggregateTimeout: 600,
        },
        resolve: {
            extensions: ['.js', '.tsx', '.ts'],
            fallback: {
                crypto: false,
                buffer: false,
                stream: false,
                iconv: false,
                path: false,
                punycode: false,
            },
        },
        entry: {
            // The order is important. The pre.js listens to index.js, and supported.js file sets a global variable that is used by unsupported.js to detect if the main bundle could be parsed.
            pre: [require.resolve('@proton/shared/lib/supported/pre.ts')],
            index: [path.resolve('./src/app/index.tsx'), require.resolve('@proton/shared/lib/supported/supported.ts')],
            unsupported: [require.resolve('@proton/shared/lib/supported/unsupported.ts')],
        },
        output: {
            filename: options.isProduction ? '[name].[contenthash:8].js' : '[name].js',
            publicPath: options.publicPath,
            chunkFilename: (pathData) => {
                const result = options.isProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js';
                const chunkName = pathData?.chunk?.name;
                if (chunkName && (chunkName.startsWith('date-fns/') || chunkName.startsWith('locales/'))) {
                    // @ts-ignore
                    const strippedChunkName = chunkName.replaceAll(/-index-js|-json/g, '');
                    return result.replace('[name]', strippedChunkName);
                }
                return result;
            },
            assetModuleFilename: (data) => {
                const { path: file } = parseResource(data?.filename || '');
                const ext = path.extname(file);
                const base = path.basename(file);
                const name = base.slice(0, base.length - ext.length);
                if (name.includes('.var')) {
                    const replacedNamed = name.replace('.var', '-var');
                    return `assets/${replacedNamed}.[hash][ext][query]`;
                }
                return 'assets/[name].[hash][ext][query]';
            },
            crossOriginLoading: 'anonymous',
        },
        cache: {
            type: 'filesystem',
            cacheDirectory: path.resolve('./node_modules/.cache/webpack'),
            buildDependencies: {
                defaultWebpack: ['webpack/lib/'],
                config: [__filename],
            },
        },
        module: {
            strictExportPresence: true, // Make missing exports an error instead of warning
            rules: [...getJsLoaders(options), ...getCssLoaders(options), ...getAssetsLoaders()],
        },
        plugins: getPlugins(options),
        optimization: getOptimizations(options),
        devServer: {
            hot: !options.isProduction,
            devMiddleware: {
                stats: 'minimal',
                publicPath: options.publicPath,
            },
            allowedHosts: 'all',
            compress: true,
            historyApiFallback: {
                index: options.publicPath,
            },
            client: {
                webSocketURL: 'auto://0.0.0.0:0/ws',
                overlay: {
                    warnings: options.overlayWarnings,
                    errors: options.overlayErrors,
                    runtimeErrors: options.overlayRuntimeErrors,
                },
            },
            webSocketServer: 'ws',
            ...(options.api && {
                proxy: {
                    '/api': {
                        target: options.api,
                        secure: false,
                        changeOrigin: true,
                        onProxyRes: (proxyRes) => {
                            delete proxyRes.headers['content-security-policy'];
                            delete proxyRes.headers['x-frame-options'];
                            proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie']?.map((cookies) =>
                                cookies
                                    .split('; ')
                                    .filter((cookie) => {
                                        return !/(secure$|samesite=|domain=)/i.test(cookie);
                                    })
                                    .join('; ')
                            );
                        },
                    },
                },
            }),
        },
    };
};

export default getConfig;

export const mergeEntry = (originalEntry: any, entry: any) => {
    const { pre, ...rest } = originalEntry;
    return {
        pre,
        ...entry,
        ...rest,
    };
};