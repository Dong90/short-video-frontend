import * as Sentry from '@sentry/nestjs';
import { capitalize } from 'lodash';

export const initializeSentry = (appName: string, allowLogs = false) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  try {
    Sentry.init({
      initialScope: {
        tags: {
          service: appName,
          component: 'nestjs',
        },
        contexts: {
          app: {
            name: `Postiz ${capitalize(appName)}`,
          },
        },
      },
      environment: process.env.NODE_ENV || 'development',
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      spotlight: process.env.SENTRY_SPOTLIGHT === '1',
      // 注意：为避免在 Docker / ARM64 环境下加载 Sentry CPU Profiler 的原生模块导致
      // `GLIBCXX_3.4.29 not found` 错误，这里暂时关闭 `@sentry/profiling-node` 集成。
      // 如果以后需要在生产环境开启 CPU Profiling，可以在确认运行环境的 libstdc++ 版本满足要求后，
      // 再恢复 `nodeProfilingIntegration()`。
      integrations: [
        Sentry.consoleLoggingIntegration({ levels: ['log', 'info', 'warn', 'error', 'debug', 'assert', 'trace'] }),
        Sentry.openAIIntegration({
          recordInputs: true,
          recordOutputs: true,
        }),
      ],
      tracesSampleRate: 1.0,
      enableLogs: true,

      // Profiling（已关闭 CPU Profiler，对应的采样配置暂时保留为占位）
      profileSessionSampleRate: 0,
      profileLifecycle: 'trace',
    });
  } catch (err) {
    console.log(err);
  }
  return true;
};
