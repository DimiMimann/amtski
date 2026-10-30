import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import {
  ImageGenerationHandler,
  ImageGenerationInput,
  ImageGenerationResult,
} from 'src/domain/models/application/ports/image-generation.handler';
import { ImageGenerationFailedError } from 'src/domain/models/application/models.errors';
import { ProviderTimeoutError } from 'src/common/errors/provider.errors';
import type { AzureImageGenerationHandler } from './azure.image-generation';

const POLL_INTERVAL_MS = 1_000;
// Jobs queue behind other clients of the same ComfyUI (e.g. Open WebUI).
const MAX_WAIT_MS = 10 * 60_000;

// Qwen-Image's native resolutions for 1:1, 16:9 and 9:16.
const SIZES: Partial<Record<string, { width: number; height: number }>> = {
  auto: { width: 1328, height: 1328 },
  square: { width: 1328, height: 1328 },
  landscape: { width: 1664, height: 928 },
  portrait: { width: 928, height: 1664 },
};

export const selectAzureImageHandler = (
  configService: ConfigService,
  azure: AzureImageGenerationHandler,
  comfyUi: ComfyUiImageGenerationHandler,
): ImageGenerationHandler =>
  configService.get<string>('models.comfyui.url') ? comfyUi : azure;

type ComfyImage = { filename: string; subfolder: string; type: string };

type ComfyHistoryEntry = {
  status?: { status_str: string; completed: boolean };
  outputs?: Record<string, { images?: ComfyImage[] }>;
};

/**
 * Text-to-image through a self-hosted ComfyUI. Serves the Azure provider slot
 * when COMFYUI_URL is set, so the catalog and API contract stay unchanged.
 */
@Injectable()
export class ComfyUiImageGenerationHandler extends ImageGenerationHandler {
  private readonly logger = new Logger(ComfyUiImageGenerationHandler.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    if (input.referenceImages?.length) {
      throw new ImageGenerationFailedError(
        'This image model cannot edit or combine existing images. Describe the complete image in the prompt instead.',
      );
    }
    const size = SIZES[input.size ?? 'auto'];
    if (!size) {
      throw new ImageGenerationFailedError(
        `Unsupported image size '${input.size}'. Supported sizes: ${Object.keys(SIZES).join(', ')}`,
      );
    }
    this.logger.log({ model: input.model.name, size }, 'Generating image');

    const { prompt_id: promptId } = (await (
      await this.request('/prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: qwenImageWorkflow(input.model.name, input.prompt, size),
        }),
      })
    ).json()) as { prompt_id: string };
    const image = await this.waitForImage(promptId, input.model.name);
    const response = await this.request(
      `/view?${new URLSearchParams(image).toString()}`,
    );
    return new ImageGenerationResult(
      Buffer.from(await response.arrayBuffer()),
      response.headers.get('content-type') ?? 'image/png',
      undefined,
      undefined,
      input.background === 'transparent' ? false : undefined,
    );
  }

  private async waitForImage(
    promptId: string,
    modelId: string,
  ): Promise<ComfyImage> {
    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      const history = (await (
        await this.request(`/history/${promptId}`)
      ).json()) as Record<string, ComfyHistoryEntry | undefined>;
      const status = history[promptId]?.status;
      if (status?.status_str === 'error') {
        throw new ImageGenerationFailedError(
          'The image server could not render this prompt',
        );
      }
      if (status?.completed) {
        const outputs = Object.values(history[promptId]?.outputs ?? {});
        const image = outputs.flatMap((output) => output.images ?? []).at(0);
        if (!image) {
          throw new ImageGenerationFailedError(
            'The image server returned no image',
          );
        }
        return image;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new ProviderTimeoutError({ provider: 'comfyui', modelId });
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const baseUrl = this.configService.get<string>('models.comfyui.url');
    const response = await fetch(new URL(path, baseUrl).toString(), init);
    if (!response.ok) {
      // `status` lets wrapProviderFailure classify 5xx and 429 as outages.
      throw Object.assign(
        new Error(
          `ComfyUI responded with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
        ),
        { status: response.status },
      );
    }
    return response;
  }
}

type WorkflowNode = { class_type: string; inputs: Record<string, unknown> };

// ponytail: the graph is Qwen-Image specific (text encoder, VAE, 4-step
// Lightning LoRA); the catalog model name only picks the diffusion weights.
// Make these configurable if another model family is ever served.
const QWEN_IMAGE_NODES: Record<string, WorkflowNode> = {
  lora: {
    class_type: 'LoraLoaderModelOnly',
    inputs: {
      lora_name: 'Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors',
      strength_model: 1,
      model: ['unet', 0],
    },
  },
  sampling: {
    class_type: 'ModelSamplingAuraFlow',
    inputs: { shift: 3.1, model: ['lora', 0] },
  },
  clip: {
    class_type: 'CLIPLoader',
    inputs: {
      clip_name: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
      type: 'qwen_image',
      device: 'default',
    },
  },
  vae: {
    class_type: 'VAELoader',
    inputs: { vae_name: 'qwen_image_vae.safetensors' },
  },
  negative: {
    class_type: 'CLIPTextEncode',
    inputs: { text: '', clip: ['clip', 0] },
  },
  decode: {
    class_type: 'VAEDecode',
    inputs: { samples: ['sampler', 0], vae: ['vae', 0] },
  },
  // Writes to ComfyUI's temp folder rather than piling up in its output.
  preview: {
    class_type: 'PreviewImage',
    inputs: { images: ['decode', 0] },
  },
};

function qwenImageWorkflow(
  unetName: string,
  prompt: string,
  size: { width: number; height: number },
): Record<string, WorkflowNode> {
  return {
    ...QWEN_IMAGE_NODES,
    unet: {
      class_type: 'UNETLoader',
      inputs: { unet_name: unetName, weight_dtype: 'default' },
    },
    positive: {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ['clip', 0] },
    },
    latent: {
      class_type: 'EmptySD3LatentImage',
      inputs: { ...size, batch_size: 1 },
    },
    sampler: {
      class_type: 'KSampler',
      inputs: {
        seed: randomInt(2 ** 47),
        steps: 4,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
        model: ['sampling', 0],
        positive: ['positive', 0],
        negative: ['negative', 0],
        latent_image: ['latent', 0],
      },
    },
  };
}
