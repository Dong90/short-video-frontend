/**
 * Short Video 平台账号同步服务
 * 在 Postiz 删除/失效频道时，同步删除 short_video 中的 platform_account
 * 供 backend 与 orchestrator 共用
 */
import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ShortVideoSyncService {
  private getBaseUrl(): string {
    const url = process.env.SHORT_VIDEO_API_URL?.trim();
    if (!url) return '';
    return url.replace(/\/$/, '');
  }

  /**
   * 按 Postiz 集成 ID 删除 short_video 中的 platform_accounts
   */
  async deletePlatformAccountsByIntegrationId(integrationId: string): Promise<void> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return;

    try {
      const listRes = await axios.get(
        `${baseUrl}/api/v1/platform-accounts?integration_id=${encodeURIComponent(integrationId)}&limit=100`,
        { timeout: 15000 }
      );
      const items = listRes?.data?.items ?? [];
      for (const acc of items) {
        if (acc?.id) {
          try {
            await axios.delete(`${baseUrl}/api/v1/platform-accounts/${acc.id}`, {
              timeout: 10000,
            });
          } catch (e: any) {
            console.warn(
              `ShortVideoSyncService: Failed to delete platform_account ${acc.id}:`,
              e?.message
            );
          }
        }
      }
    } catch (e: any) {
      console.warn(
        'ShortVideoSyncService.deletePlatformAccountsByIntegrationId failed:',
        e?.message
      );
    }
  }
}
