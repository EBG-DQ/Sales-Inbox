import { serve } from "inngest/express";
import { inngest } from "../lib/inngest";
import {
  assignLeadAndCreateTask,
  logLeadUpdate,
} from "./functions";

export const inngestHandler = serve({
  client: inngest,
  functions: [assignLeadAndCreateTask, logLeadUpdate],
});