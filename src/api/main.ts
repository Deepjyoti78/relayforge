import 'reflect-metadata';
import { RuntimeConfig } from '../modules/config/config.module';
import { exitOnStartupFailure } from '../modules/observability/startup-error';
import { createApiApplication } from './create-api';

async function bootstrap(): Promise<void> {
  const app = await createApiApplication();
  const config = app.get(RuntimeConfig).values;
  await app.listen(config.port, config.host);
}

void bootstrap().catch((error: unknown) => exitOnStartupFailure('api', error));
