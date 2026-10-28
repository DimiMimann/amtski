import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BraveInternetSearchHandler } from './infrastructure/handlers/brave-internet-search.handler';
import { StaanInternetSearchHandler } from './infrastructure/handlers/staan-internet-search.handler';
import { SearxngInternetSearchHandler } from './infrastructure/handlers/searxng-internet-search.handler';
import { SearchWebUseCase } from './application/use-cases/search-web/search-web.use-case';
import { InternetSearchHandler } from './application/ports/internet-search.handler';

@Module({
  providers: [
    BraveInternetSearchHandler,
    StaanInternetSearchHandler,
    SearxngInternetSearchHandler,
    {
      // Provider selected by the INTERNET_SEARCH_PROVIDER env var (default brave).
      provide: InternetSearchHandler,
      inject: [
        ConfigService,
        BraveInternetSearchHandler,
        StaanInternetSearchHandler,
        SearxngInternetSearchHandler,
      ],
      useFactory: (
        configService: ConfigService,
        brave: BraveInternetSearchHandler,
        staan: StaanInternetSearchHandler,
        searxng: SearxngInternetSearchHandler,
      ): InternetSearchHandler => {
        const provider = configService.get<string>('internetSearch.provider');
        if (provider === 'staan') return staan;
        if (provider === 'searxng') return searxng;
        return brave;
      },
    },
    SearchWebUseCase,
  ],
  exports: [SearchWebUseCase],
})
export class InternetSearchRetrieverModule {}
