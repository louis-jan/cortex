import { CortexUsecases } from '@/usecases/cortex/cortex.usecases';
import {
  CommandRunner,
  SubCommand,
  Option,
  InquirerService,
} from 'nest-commander';
import { exit } from 'node:process';
import { ChatCliUsecases } from '@commanders/usecases/chat.cli.usecases';
import { ModelsCliUsecases } from '@commanders/usecases/models.cli.usecases';
import { ModelNotFoundException } from '@/infrastructure/exception/model-not-found.exception';
import { existsSync } from 'fs';
import { join } from 'path';
import { FileManagerService } from '@/infrastructure/services/file-manager/file-manager.service';
import { InitCliUsecases } from '../usecases/init.cli.usecases';
import { Engines } from '../types/engine.interface';
import { checkModelCompatibility } from '@/utils/model-check';

type RunOptions = {
  threadId?: string;
  preset?: string;
};

@SubCommand({
  name: 'run',
  arguments: '[model_id]',
  argsDescription: {
    model_id:
      'Model to run. If the model is not available, it will attempt to pull.',
  },
  description: 'Shortcut to start a model and chat',
})
export class RunCommand extends CommandRunner {
  constructor(
    private readonly modelsCliUsecases: ModelsCliUsecases,
    private readonly cortexUsecases: CortexUsecases,
    private readonly chatCliUsecases: ChatCliUsecases,
    private readonly inquirerService: InquirerService,
    private readonly fileService: FileManagerService,
    private readonly initUsecases: InitCliUsecases,
  ) {
    super();
  }

  async run(passedParams: string[], options: RunOptions): Promise<void> {
    let modelId = passedParams[0];
    if (!modelId) {
      try {
        modelId = await this.modelInquiry();
      } catch {
        console.error('Model ID is required');
        exit(1);
      }
    }

    // If not exist
    // Try Pull
    if (!(await this.modelsCliUsecases.getModel(modelId))) {
      console.log(
        `${modelId} not found on filesystem. Downloading from remote: https://huggingface.co/cortexso if possible.`,
      );
      await this.modelsCliUsecases.pullModel(modelId).catch((e: Error) => {
        if (e instanceof ModelNotFoundException)
          console.error('Model does not exist.');
        else console.error(e.message ?? e);
        exit(1);
      });
    }

    // Second check if model is available
    const existingModel = await this.modelsCliUsecases.getModel(modelId);
    if (
      !existingModel ||
      !Array.isArray(existingModel.files) ||
      /^(http|https):\/\/[^/]+\/.*/.test(existingModel.files[0])
    ) {
      console.error('Model is not available.');
      process.exit(1);
    }

    checkModelCompatibility(modelId);

    const engine = existingModel.engine || Engines.llamaCPP;
    // Pull engine if not exist
    if (
      !existsSync(join(await this.fileService.getCortexCppEnginePath(), engine))
    ) {
      await this.initUsecases.installEngine(
        await this.initUsecases.defaultInstallationOptions(),
        'latest',
        engine,
      );
    }

    return this.cortexUsecases
      .startCortex(false)
      .then(() => this.modelsCliUsecases.startModel(modelId, options.preset))
      .then(() => this.chatCliUsecases.chat(modelId, options.threadId));
  }

  @Option({
    flags: '-t, --thread <thread_id>',
    description: 'Thread Id. If not provided, will create new thread',
  })
  parseThreadId(value: string) {
    return value;
  }

  @Option({
    flags: '-p, --preset <preset>',
    description: 'Apply a chat preset to the chat session',
  })
  parseTemplate(value: string) {
    return value;
  }

  modelInquiry = async () => {
    const models = await this.modelsCliUsecases.listAllModels();
    if (!models.length) throw 'No models found';
    const { model } = await this.inquirerService.inquirer.prompt({
      type: 'list',
      name: 'model',
      message: 'Select a model to start:',
      choices: models.map((e) => ({
        name: e.name,
        value: e.model,
      })),
    });
    return model;
  };
}
