export class WorkerEntrypoint<E = unknown> {
  env: E;
  ctx: unknown;
  constructor(ctx: unknown, env: E) {
    this.ctx = ctx;
    this.env = env;
  }
}
