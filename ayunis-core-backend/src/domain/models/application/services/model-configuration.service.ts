import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import {
  ModelArchivedError,
  ModelNotConfiguredError,
} from 'src/domain/models/application/models.errors';
import { ModelProviderInfoRegistry } from 'src/domain/models/application/registry/model-provider-info.registry';
import type { Model } from 'src/domain/models/domain/model.entity';
import { ModelProvider } from 'src/domain/models/domain/value-objects/model-provider.enum';
import { ModelType } from 'src/domain/models/domain/value-objects/model-type.enum';

@Injectable()
export class ModelConfigurationService {
  constructor(
    private readonly configService: ConfigService,
    private readonly modelProviderInfoRegistry: ModelProviderInfoRegistry,
  ) {}

  isConfiguredAndActive(model: Model): boolean {
    return !model.isArchived && this.hasProviderConfiguration(model);
  }

  assertConfiguredAndActive(model: Model): void {
    if (model.isArchived) {
      throw new ModelArchivedError(model.id);
    }
    if (!this.hasProviderConfiguration(model)) {
      throw new ModelNotConfiguredError(model.id);
    }
  }

  private hasProviderConfiguration(model: Model): boolean {
    // ComfyUI serves the Azure image slot (see selectAzureImageHandler).
    const configKey =
      model.type === ModelType.IMAGE_GENERATION &&
      model.provider === ModelProvider.AZURE &&
      this.configService.get<string>('models.comfyui.url')
        ? 'models.comfyui.url'
        : this.modelProviderInfoRegistry.getConfigKey(model.provider);
    if (!configKey) {
      return false;
    }
    const configuration = this.configService.get<string>(configKey);
    return typeof configuration === 'string' && configuration.trim() !== '';
  }
}
