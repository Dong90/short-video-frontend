/**
 * Short Video 平台账号同步服务（Backend 扩展）
 * 在 Postiz 添加频道时创建 platform_account；删除委托给 nestjs-libraries 的 ShortVideoSyncService
 */
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ShortVideoSyncService as LibShortVideoSyncService } from '@gitroom/nestjs-libraries/short-video-sync/short-video-sync.service';

/** Postiz 集成类型到 short_video platform 的映射 */
const PROVIDER_TO_PLATFORM: Record<string, string> = {
  youtube: 'youtube',
  'youtube-channel': 'youtube_shorts',
  tiktok: 'tiktok',
  instagram: 'instagram_reels',
  'instagram-standalone': 'instagram_reels',
  douyin: 'douyin',
  bilibili: 'bilibili',
};

/** short_video 支持的平台（用于判断是否需要创建） */
const SHORT_VIDEO_PLATFORMS = new Set([
  'youtube',
  'youtube_shorts',
  'tiktok',
  'instagram_reels',
  'douyin',
  'bilibili',
]);

@Injectable()
export class ShortVideoSyncService {
  private _lastSyncFailureReason: string | null = null;

  constructor(private _libSync: LibShortVideoSyncService) {}

  /** 用于控制器返回具体失败原因 */
  getLastSyncFailureReason(): string | null {
    return this._lastSyncFailureReason;
  }

  private getBaseUrl(): string {
    const url = process.env.SHORT_VIDEO_API_URL?.trim();
    if (!url) return '';
    return url.replace(/\/$/, '');
  }

  /**
   * 获取 short_video 平台名称
   */
  getPlatformForProvider(provider: string): string | null {
    const platform = PROVIDER_TO_PLATFORM[provider?.toLowerCase()];
    return platform && SHORT_VIDEO_PLATFORMS.has(platform) ? platform : null;
  }

  /**
   * 是否为需要同步到 short_video 的平台
   */
  shouldSyncForProvider(provider: string): boolean {
    return this.getPlatformForProvider(provider) !== null;
  }

  /**
   * 为 Postiz 集成创建 short_video platform_account
   * 若已存在（按 integration_id）、则更新而非新建
   */
  async createPlatformAccountForIntegration(params: {
    integrationId: string;
    organizationId: string;
    name: string;
    picture?: string;
    provider: string;
    /** Postiz 侧的原生账号 ID（如 YouTube channel_id），用于写入 short_video 的 account_id */
    accountId?: string;
    /** 兼容旧字段（内部使用），优先使用 accountId */
    internalId?: string;
  }): Promise<{ id?: string } | null> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return null;

    const platform = this.getPlatformForProvider(params.provider);
    if (!platform) return null;

    try {
      // 若已存在则更新，避免重复创建
      const listRes = await axios.get(
        `${baseUrl}/api/v1/platform-accounts?integration_id=${encodeURIComponent(params.integrationId)}&limit=1`,
        { timeout: 10000 }
      );
      const items = listRes?.data?.items ?? [];
      if (items.length > 0 && items[0]?.id) {
        const cfg = (items[0].config || {}) as Record<string, unknown>;
        const updateBody: Record<string, unknown> = {
          name: params.name || items[0].name,
          // 按 short_video 新版 API：postiz 为顶层字段，由后端合并进 config
          postiz: {
            organization_id: params.organizationId,
            integration_id: params.integrationId,
          },
          // 其余配置仍通过 config 传递，避免覆盖已有字段
          config: {
            ...cfg,
            avatar_url: params.picture ?? (cfg as any).avatar_url,
          },
          // 若已有账号尚未写入 account_id，则补写一份（以原生 ID 为准）
          ...(params.accountId
            ? {
                account_id: params.accountId,
              }
            : {}),
        };
        await axios.put(
          `${baseUrl}/api/v1/platform-accounts/${items[0].id}`,
          updateBody,
          { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
        );
        return { id: items[0].id };
      }

      const body = {
        name: params.name || `Channel_${String(params.internalId || params.integrationId).slice(0, 16)}`,
        platform,
        status: 'active',
        // postiz 顶层字段，short_video 会在服务端写入 config.postiz
        postiz: {
          organization_id: params.organizationId,
          integration_id: params.integrationId,
        },
        // 平台原生 ID，写入 short_video 的 account_id 字段
        ...(params.accountId
          ? {
              account_id: params.accountId,
            }
          : {}),
        // config 仅携带平台和头像等基础配置
        config: {
          platform,
          avatar_url: params.picture || undefined,
        },
      };

      const res = await axios.post(
        `${baseUrl}/api/v1/platform-accounts`,
        body,
        {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return res?.data ? { id: res.data.id } : null;
    } catch (e: any) {
      console.warn(
        'ShortVideoSyncService.createPlatformAccountForIntegration failed:',
        e?.response?.data?.detail || e?.message
      );
      return null;
    }
  }

  /**
   * 同步平台账号：若已有按 integration_id 关联的则返回；若无则尝试关联同平台未关联账号；否则创建新账号
   */
  async syncPlatformAccountForIntegration(params: {
    integrationId: string;
    organizationId: string;
    name: string;
    picture?: string;
    provider: string;
    /** 平台原生账号 ID（如 YouTube channel_id），用于写入 account_id */
    accountId?: string;
  }): Promise<{ id: string } | null> {
    this._lastSyncFailureReason = null;
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      this._lastSyncFailureReason =
        'SHORT_VIDEO_API_URL 未配置，请在环境变量中设置 short_video 后端地址';
      console.warn('[syncPlatformAccountForIntegration]', this._lastSyncFailureReason);
      return null;
    }

    const platform = this.getPlatformForProvider(params.provider);
    if (!platform) {
      this._lastSyncFailureReason = `当前平台 "${params.provider}" 不支持短视频同步，仅支持: youtube, youtube-channel, tiktok, instagram, douyin, bilibili`;
      console.warn('[syncPlatformAccountForIntegration]', this._lastSyncFailureReason);
      return null;
    }

    try {
      // 1. 已有按 integration_id 关联的？
      const listRes = await axios.get(
        `${baseUrl}/api/v1/platform-accounts?integration_id=${encodeURIComponent(params.integrationId)}&limit=1`,
        { timeout: 10000 }
      );
      const items = listRes?.data?.items ?? [];
      if (items.length > 0 && items[0]?.id) return { id: items[0].id };

      // 2. 拉取同平台账号，找未关联或可关联的（youtube 与 youtube_shorts 互通）
      const platformsToTry = platform === 'youtube_shorts' ? ['youtube', 'youtube_shorts'] : [platform];
      let all: any[] = [];
      for (const p of platformsToTry) {
        const allRes = await axios.get(
          `${baseUrl}/api/v1/platform-accounts?platform=${encodeURIComponent(p)}&limit=50`,
          { timeout: 10000 }
        );
        all = allRes?.data?.items ?? [];
        if (all.length > 0) break;
      }
      for (const acc of all) {
        const cfg = (acc.config || {}) as Record<string, unknown>;
        const postiz = cfg?.postiz as { integration_id?: string } | undefined;
        const linked = postiz?.integration_id;
        if (!linked || linked === params.integrationId) {
          const linkedResult = await this.linkPlatformAccountToIntegration({
            platformAccountId: acc.id,
            integrationId: params.integrationId,
            organizationId: params.organizationId,
          });
          if (linkedResult) return linkedResult;
        }
      }

      // 3. 创建新账号
      const created = await this.createPlatformAccountForIntegration({
        ...params,
        // internalId 仅用于生成占位名，真实账号 ID 用 accountId
        internalId: params.integrationId,
      });
      const createdId = created?.id ? { id: created.id } : null;
      if (!createdId) {
        this._lastSyncFailureReason =
          'short_video 创建 platform_account 失败，请查看后端日志';
      }
      return createdId;
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || String(e);
      this._lastSyncFailureReason = `short_video 请求失败: ${detail}`;
      console.warn(
        'ShortVideoSyncService.syncPlatformAccountForIntegration failed:',
        detail
      );
      return null;
    }
  }

  /**
   * 将已有的 platform_account 关联到 Postiz 集成（写入 config.postiz.integration_id）
   * 用于历史账号或通过 short_video 独立创建的账号
   */
  async linkPlatformAccountToIntegration(params: {
    platformAccountId: string;
    integrationId: string;
    organizationId: string;
  }): Promise<{ id: string } | null> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return null;

    try {
      const getRes = await axios.get(
        `${baseUrl}/api/v1/platform-accounts/${params.platformAccountId}`,
        { timeout: 10000 }
      );
      const acc = getRes?.data;
      if (!acc?.id) return null;

      // 仅更新 postiz 顶层字段，由 short_video 后端合并到 config.postiz
      const updateBody: Record<string, unknown> = {
        postiz: {
          organization_id: params.organizationId,
          integration_id: params.integrationId,
        },
      };

      await axios.put(
        `${baseUrl}/api/v1/platform-accounts/${params.platformAccountId}`,
        updateBody,
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
      );
      return { id: params.platformAccountId };
    } catch (e: any) {
      console.warn(
        'ShortVideoSyncService.linkPlatformAccountToIntegration failed:',
        e?.response?.data?.detail || e?.message
      );
      return null;
    }
  }

  /**
   * 按 Postiz 集成 ID 删除 short_video 中的 platform_accounts（委托给 lib）
   */
  async deletePlatformAccountsByIntegrationId(integrationId: string): Promise<void> {
    return this._libSync.deletePlatformAccountsByIntegrationId(integrationId);
  }
}
