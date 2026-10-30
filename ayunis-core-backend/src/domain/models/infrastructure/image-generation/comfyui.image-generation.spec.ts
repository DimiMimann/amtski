import type { ConfigService } from '@nestjs/config';
import {
  ComfyUiImageGenerationHandler,
  selectAzureImageHandler,
} from './comfyui.image-generation';
import type { AzureImageGenerationHandler } from './azure.image-generation';
import { ImageGenerationInput } from 'src/domain/models/application/ports/image-generation.handler';
import { ImageGenerationModel } from 'src/domain/models/domain/models/image-generation.model';
import { ModelProvider } from 'src/domain/models/domain/value-objects/model-provider.enum';
import { ImageGenerationFailedError } from 'src/domain/models/application/models.errors';
import { ProviderTimeoutError } from 'src/common/errors/provider.errors';

const BASE = 'http://comfyui.test:8188';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

type WorkflowNode = { class_type: string; inputs: Record<string, unknown> };

describe('selectAzureImageHandler', () => {
  const azure = { name: 'azure' } as unknown as AzureImageGenerationHandler;
  const comfyUi = {
    name: 'comfyui',
  } as unknown as ComfyUiImageGenerationHandler;
  const withComfyUiUrl = (url: string | undefined) =>
    ({ get: jest.fn(() => url) }) as unknown as ConfigService;

  it('uses ComfyUI when a ComfyUI URL is configured', () => {
    expect(selectAzureImageHandler(withComfyUiUrl(BASE), azure, comfyUi)).toBe(
      comfyUi,
    );
  });

  it('keeps Azure otherwise', () => {
    expect(
      selectAzureImageHandler(withComfyUiUrl(undefined), azure, comfyUi),
    ).toBe(azure);
  });
});

describe('ComfyUiImageGenerationHandler', () => {
  const handler = new ComfyUiImageGenerationHandler({
    get: () => BASE,
  } as unknown as ConfigService);
  const model = new ImageGenerationModel({
    name: 'qwen_image_2512_fp8_e4m3fn.safetensors',
    provider: ModelProvider.AZURE,
    displayName: 'Qwen Image',
    isArchived: false,
  });
  let fetchSpy: jest.SpyInstance;

  const input = (
    params: Partial<ConstructorParameters<typeof ImageGenerationInput>[0]> = {},
  ) => new ImageGenerationInput({ model, prompt: 'Ein Rathaus', ...params });

  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  function serve(
    history: unknown[] = [
      {
        p1: {
          status: { status_str: 'success', completed: true },
          outputs: {
            save: {
              images: [{ filename: 'a.png', subfolder: '', type: 'temp' }],
            },
          },
        },
      },
    ],
    submitStatus = 200,
  ): void {
    let uploads = 0;
    fetchSpy.mockImplementation((url: string) => {
      if (url.endsWith('/upload/image')) {
        uploads += 1;
        return json({
          name: `up-${uploads}.png`,
          subfolder: '',
          type: 'input',
        });
      }
      if (url.endsWith('/prompt')) {
        return json({ prompt_id: 'p1' }, submitStatus);
      }
      if (url.includes('/history/p1')) {
        return json(history.length > 1 ? history.shift() : history[0]);
      }
      return Promise.resolve(
        new Response(new Uint8Array(PNG), {
          headers: { 'content-type': 'image/png' },
        }),
      );
    });
  }

  function submittedGraph(): Record<string, WorkflowNode> {
    const [, init] = (fetchSpy.mock.calls as [string, RequestInit][]).find(
      ([url]) => url.endsWith('/prompt'),
    )!;
    return (
      JSON.parse(init.body as string) as {
        prompt: Record<string, WorkflowNode>;
      }
    ).prompt;
  }

  const submittedWorkflow = () => Object.values(submittedGraph());

  const node = (type: string) =>
    submittedWorkflow().find((n) => n.class_type === type)?.inputs;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the prompt with the catalog model and returns the image', async () => {
    serve();

    const result = await handler.generate(input());

    expect(result.imageData).toEqual(PNG);
    expect(result.contentType).toBe('image/png');
    expect(node('UNETLoader')?.unet_name).toBe(model.name);
    const [positiveId] = node('KSampler')?.positive as [string, number];
    expect(submittedGraph()[positiveId].inputs.text).toBe('Ein Rathaus');
    const [viewUrl] = fetchSpy.mock.calls.at(-1) as [string];
    expect(viewUrl).toBe(`${BASE}/view?filename=a.png&subfolder=&type=temp`);
  });

  it.each([
    ['landscape', 1664, 928],
    ['portrait', 928, 1664],
    ['square', 1328, 1328],
    [undefined, 1328, 1328],
  ])('maps size %s to %ix%i', async (size, width, height) => {
    serve();

    await handler.generate(input({ size }));

    expect(node('EmptySD3LatentImage')).toMatchObject({ width, height });
  });

  it('polls until the job has finished', async () => {
    jest.useFakeTimers();
    serve([
      {},
      { p1: { status: { status_str: 'success', completed: false } } },
      {
        p1: {
          status: { status_str: 'success', completed: true },
          outputs: {
            save: {
              images: [{ filename: 'a.png', subfolder: '', type: 'temp' }],
            },
          },
        },
      },
    ]);

    const generating = handler.generate(input());
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(generating).resolves.toHaveProperty(
      'contentType',
      'image/png',
    );
  });

  it('reports a job ComfyUI could not execute', async () => {
    serve([{ p1: { status: { status_str: 'error', completed: false } } }]);

    await expect(handler.generate(input())).rejects.toBeInstanceOf(
      ImageGenerationFailedError,
    );
  });

  it('gives up on a job that never finishes', async () => {
    jest.useFakeTimers();
    serve([{}]);

    const generating = handler.generate(input());
    const assertion =
      expect(generating).rejects.toBeInstanceOf(ProviderTimeoutError);
    await jest.advanceTimersByTimeAsync(11 * 60_000);
    await assertion;
  });

  it('edits reference images with the Qwen-Image-Edit workflow', async () => {
    serve();
    const reference = { data: PNG, contentType: 'image/png' };

    const result = await handler.generate(
      input({
        prompt: 'Setze dem Hund einen Hut auf',
        referenceImages: [reference, reference],
      }),
    );

    expect(result.imageData).toEqual(PNG);
    const uploadCalls = fetchSpy.mock.calls.filter(([url]) =>
      (url as string).endsWith('/upload/image'),
    );
    expect(uploadCalls).toHaveLength(2);
    const graph = submittedWorkflow();
    expect(
      graph
        .filter((n) => n.class_type === 'LoadImage')
        .map((n) => n.inputs.image),
    ).toEqual(['up-1.png', 'up-2.png']);
    expect(node('UNETLoader')?.unet_name).toBe(
      'qwen_image_edit_2511_int8_convrot.safetensors',
    );
    const [positiveId] = node('KSampler')?.positive as [string, number];
    const [encoderId] = submittedGraph()[positiveId].inputs.conditioning as [
      string,
      number,
    ];
    const encoder = submittedGraph()[encoderId].inputs;
    expect(encoder.prompt).toBe('Setze dem Hund einen Hut auf');
    expect(encoder).toHaveProperty('image1');
    expect(encoder).toHaveProperty('image2');
    expect(encoder).not.toHaveProperty('image3');
  });

  it('rejects more reference images than the edit model takes', async () => {
    serve();
    const reference = { data: PNG, contentType: 'image/png' };

    await expect(
      handler.generate(
        input({
          referenceImages: [reference, reference, reference, reference],
        }),
      ),
    ).rejects.toBeInstanceOf(ImageGenerationFailedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports that a transparent background was not applied', async () => {
    serve();

    const result = await handler.generate(input({ background: 'transparent' }));

    expect(result.transparencyApplied).toBe(false);
  });

  it('exposes the HTTP status of a failed request', async () => {
    serve(undefined, 503);

    await expect(handler.generate(input())).rejects.toMatchObject({
      status: 503,
    });
  });
});
