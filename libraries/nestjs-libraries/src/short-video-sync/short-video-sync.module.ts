import { Global, Module } from '@nestjs/common';
import { ShortVideoSyncService } from './short-video-sync.service';

@Global()
@Module({
  providers: [
    ShortVideoSyncService,
    {
      provide: 'SHORT_VIDEO_ON_DISCONNECT',
      useFactory: (svc: ShortVideoSyncService) => (id: string) =>
        svc.deletePlatformAccountsByIntegrationId(id),
      inject: [ShortVideoSyncService],
    },
  ],
  exports: [ShortVideoSyncService, 'SHORT_VIDEO_ON_DISCONNECT'],
})
export class ShortVideoSyncModule {}
