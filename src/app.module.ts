import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { ItemsController } from './items/items.controller';
import { ItemsService } from './items/items.service';
import { DbModule } from './db/db.module';
import { CacheModule } from './cache/cache.module';
import { BrokerModule } from './broker/broker.module';
import { StorageModule } from './storage/storage.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    DbModule,
    CacheModule,
    BrokerModule,
    StorageModule,
    SearchModule,
  ],
  controllers: [HealthController, ItemsController],
  providers: [ItemsService],
})
export class AppModule {}
