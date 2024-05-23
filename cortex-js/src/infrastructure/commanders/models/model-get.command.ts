import { CommandRunner, SubCommand } from 'nest-commander';
import { ModelsCliUsecases } from '../usecases/models.cli.usecases';
import { exit } from 'node:process';

@SubCommand({ name: 'get', description: 'Get a model by ID.' })
export class ModelGetCommand extends CommandRunner {
  constructor(private readonly modelsCliUsecases: ModelsCliUsecases) {
    super();
  }

  async run(input: string[]): Promise<void> {
    if (input.length === 0) {
      console.error('Model ID is required');
      exit(1);
    }

    const models = await this.modelsCliUsecases.getModel(input[0]);
    console.log(models);
  }
}