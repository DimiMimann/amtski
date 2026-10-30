import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  ModelArchivedError,
  ModelNotConfiguredError,
} from 'src/domain/models/application/models.errors';
import { ModelProviderInfoRegistry } from 'src/domain/models/application/registry/model-provider-info.registry';
import { ModelConfigurationService } from 'src/domain/models/application/services/model-configuration.service';
import { LanguageModel } from 'src/domain/models/domain/models/language.model';
import { ImageGenerationModel } from 'src/domain/models/domain/models/image-generation.model';
import { ModelProvider } from 'src/domain/models/domain/value-objects/model-provider.enum';

const createLanguageModel = (params?: {
  provider?: ModelProvider;
  isArchived?: boolean;
}): LanguageModel =>
  new LanguageModel({
    name: 'municipal-assistant',
    displayName: 'Municipal Assistant',
    provider: params?.provider ?? ModelProvider.OPENAI,
    canStream: true,
    isReasoning: false,
    isArchived: params?.isArchived ?? false,
    canUseTools: true,
    canVision: false,
    contextWindowSize: 128_000,
  });

describe('ModelConfigurationService', () => {
  let service: ModelConfigurationService;
  let configService: jest.Mocked<ConfigService>;
  let providerRegistry: jest.Mocked<ModelProviderInfoRegistry>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelConfigurationService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: ModelProviderInfoRegistry,
          useValue: { getConfigKey: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ModelConfigurationService);
    configService = module.get(ConfigService);
    providerRegistry = module.get(ModelProviderInfoRegistry);
    providerRegistry.getConfigKey.mockReturnValue('models.openai.apiKey');
  });

  it('accepts an active model with configured provider credentials', () => {
    const model = createLanguageModel();
    configService.get.mockReturnValue('configured-provider-key');

    expect(service.isConfiguredAndActive(model)).toBe(true);
    expect(() => service.assertConfiguredAndActive(model)).not.toThrow();
  });

  it('rejects a model whose provider credentials are blank', () => {
    const model = createLanguageModel();
    configService.get.mockReturnValue('   ');

    expect(service.isConfiguredAndActive(model)).toBe(false);
    expect(() => service.assertConfiguredAndActive(model)).toThrow(
      ModelNotConfiguredError,
    );
  });

  it('rejects an archived model even when its provider is configured', () => {
    const model = createLanguageModel({ isArchived: true });
    configService.get.mockReturnValue('configured-provider-key');

    expect(service.isConfiguredAndActive(model)).toBe(false);
    expect(() => service.assertConfiguredAndActive(model)).toThrow(
      ModelArchivedError,
    );
  });

  it('rejects a model whose provider has no supported configuration mapping', () => {
    const model = createLanguageModel({ provider: ModelProvider.SCALEWAY });
    providerRegistry.getConfigKey.mockReturnValue(undefined);

    expect(service.isConfiguredAndActive(model)).toBe(false);
    expect(() => service.assertConfiguredAndActive(model)).toThrow(
      ModelNotConfiguredError,
    );
    expect(configService.get).not.toHaveBeenCalled();
  });

  describe('with ComfyUI serving the Azure image slot', () => {
    const configWith = (values: Record<string, string>) =>
      configService.get.mockImplementation((key: string) => values[key]);

    beforeEach(() => {
      providerRegistry.getConfigKey.mockReturnValue('models.azure.apiKey');
    });

    it('accepts an Azure image model without Azure credentials', () => {
      configWith({ 'models.comfyui.url': 'http://comfyui.test:8188' });
      const model = new ImageGenerationModel({
        name: 'qwen_image_2512_fp8_e4m3fn.safetensors',
        displayName: 'Bild',
        provider: ModelProvider.AZURE,
        isArchived: false,
      });

      expect(service.isConfiguredAndActive(model)).toBe(true);
    });

    it('still requires Azure credentials for Azure language models', () => {
      configWith({ 'models.comfyui.url': 'http://comfyui.test:8188' });

      expect(
        service.isConfiguredAndActive(
          createLanguageModel({ provider: ModelProvider.AZURE }),
        ),
      ).toBe(false);
    });
  });
});
