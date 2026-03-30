import { Global, Module } from '@nestjs/common';
import { CacheHelperService } from './cache-helper.service';

@Global()
@Module({
  providers: [CacheHelperService],
  exports: [CacheHelperService],
})
export class CacheHelperModule {}
