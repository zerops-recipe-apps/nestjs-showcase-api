import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { ServicesController } from './health/services.controller';
import { ItemsModule } from './items/items.module';
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
    ItemsModule,
  ],
  controllers: [HealthController, ServicesController],
})
export class AppModule {}
