import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listJobs from "./tools/list-jobs";
import getJob from "./tools/get-job";
import listApplications from "./tools/list-applications";
import createApplication from "./tools/create-application";
import updateApplication from "./tools/update-application";
import getResume from "./tools/get-resume";
import listWorkspaces from "./tools/list-workspaces";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hireos",
  title: "hireOS",
  version: "0.1.0",
  instructions:
    "Tools for hireOS, a job-search workspace. Read the signed-in user's imported jobs, applications, tailored resume workspaces, and base resume, and create or update tracked applications.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listJobs, getJob, listApplications, createApplication, updateApplication, getResume, listWorkspaces],
});
