import * as core from "@actions/core";
import { wait } from "./wait";

async function run(): Promise<void> {
  try {
    const ms: string = core.getInput("milliseconds");
    core.info(`Waiting ${ms} milliseconds ...`); // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true
    await wait(parseInt(ms, 10));
    core.debug(new Date().toTimeString());
    core.info("Output to the actions build log");
    core.notice("This is a message that will also emit an annotation");
    core.setOutput("time", new Date().toTimeString());
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
