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
  constructor(private _libSync: LibShortVideoSyncService) {}

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
          config: {
            ...cfg,
            postiz: {
              organization_id: params.organizationId,
              integration_id: params.integrationId,
            },
            avatar_url: params.picture ?? cfg.avatar_url,
          },
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
        config: {
          platform,
          postiz: {
            organization_id: params.organizationId,
            integration_id: params.integrationId,
          },
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
   * 按 Postiz 集成 ID 删除 short_video 中的 platform_accounts（委托给 lib）
   */
  async deletePlatformAccountsByIntegrationId(integrationId: string): Promise<void> {
    return this._libSync.deletePlatformAccountsByIntegrationId(integrationId);
  }
}
